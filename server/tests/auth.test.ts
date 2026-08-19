import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/config/prisma';
import { auth, disconnect, login, PASSWORD, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;

beforeAll(async () => {
  f = await seedFixtures();
});

afterAll(disconnect);

describe('registration', () => {
  it('creates an account and returns an access token', async () => {
    const response = await request(f.app)
      .post('/api/auth/register')
      .send({
        name: 'New Person',
        email: 'new.person@test.local',
        phone: '+91 90000 12345',
        password: 'GoodPass123',
        confirmPassword: 'GoodPass123',
      })
      .expect(201);

    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.user.email).toBe('new.person@test.local');
    expect(response.body.user.role).toBe('CUSTOMER');
  });

  it('never returns the password hash', async () => {
    const response = await request(f.app).post('/api/auth/register').send({
      name: 'Hash Check',
      email: 'hash.check@test.local',
      phone: '+91 90000 12346',
      password: 'GoodPass123',
      confirmPassword: 'GoodPass123',
    });

    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('stores the password hashed, not in plain text', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'new.person@test.local' } });
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toBe('GoodPass123');
    expect(user?.passwordHash.startsWith('$2')).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const response = await request(f.app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate',
        email: f.customer.email,
        phone: '+91 90000 99999',
        password: 'GoodPass123',
        confirmPassword: 'GoodPass123',
      })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects mismatched passwords', async () => {
    const response = await request(f.app)
      .post('/api/auth/register')
      .send({
        name: 'Mismatch',
        email: 'mismatch@test.local',
        phone: '+91 90000 88888',
        password: 'GoodPass123',
        confirmPassword: 'DifferentPass123',
      })
      .expect(422);

    expect(response.body.error.details).toHaveProperty('confirmPassword');
  });

  it('rejects a weak password', async () => {
    const response = await request(f.app)
      .post('/api/auth/register')
      .send({
        name: 'Weak',
        email: 'weak@test.local',
        phone: '+91 90000 77777',
        password: 'short',
        confirmPassword: 'short',
      })
      .expect(422);

    expect(response.body.error.details).toHaveProperty('password');
  });

  it('rejects an invalid email', async () => {
    await request(f.app)
      .post('/api/auth/register')
      .send({
        name: 'Bad Email',
        email: 'not-an-email',
        phone: '+91 90000 66666',
        password: 'GoodPass123',
        confirmPassword: 'GoodPass123',
      })
      .expect(422);
  });
});

describe('login', () => {
  it('signs in with correct credentials', async () => {
    const response = await request(f.app)
      .post('/api/auth/login')
      .send({ email: f.customer.email, password: PASSWORD })
      .expect(200);

    expect(response.body.accessToken).toBeTruthy();
  });

  it('sets an httpOnly refresh cookie rather than exposing it to scripts', async () => {
    const response = await request(f.app)
      .post('/api/auth/login')
      .send({ email: f.customer.email, password: PASSWORD })
      .expect(200);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const refresh = cookies.find((cookie) => cookie.startsWith('alaap_rt='));

    expect(refresh).toBeDefined();
    expect(refresh).toMatch(/HttpOnly/i);
  });

  it('rejects a wrong password', async () => {
    const response = await request(f.app)
      .post('/api/auth/login')
      .send({ email: f.customer.email, password: 'WrongPassword123' })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives the same message for an unknown email, revealing nothing', async () => {
    const unknown = await request(f.app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: 'WrongPassword123' })
      .expect(401);

    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('sessions', () => {
  it('returns the signed-in customer and their stats', async () => {
    const { token } = await login(f.app, f.customer.email);
    const response = await request(f.app).get('/api/auth/me').set(auth(token)).expect(200);

    expect(response.body.user.email).toBe(f.customer.email);
    expect(response.body.stats).toHaveProperty('orderCount');
    expect(response.body.stats).toHaveProperty('addressCount');
  });

  it('refuses a request with no token', async () => {
    await request(f.app).get('/api/auth/me').expect(401);
  });

  it('refuses a forged token', async () => {
    await request(f.app).get('/api/auth/me').set(auth('not.a.real.token')).expect(401);
  });

  it('exchanges the refresh cookie for a new access token', async () => {
    const { cookie } = await login(f.app, f.customer.email);
    const response = await request(f.app).post('/api/auth/refresh').set('Cookie', cookie).expect(200);

    expect(response.body.accessToken).toBeTruthy();
  });

  it('rotates the refresh token so a used one cannot be replayed', async () => {
    const { cookie } = await login(f.app, f.customer.email);

    await request(f.app).post('/api/auth/refresh').set('Cookie', cookie).expect(200);
    // The same cookie a second time must fail — it has been consumed.
    await request(f.app).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('invalidates the refresh token on logout', async () => {
    const { cookie } = await login(f.app, f.customer.email);

    await request(f.app).post('/api/auth/logout').set('Cookie', cookie).expect(200);
    await request(f.app).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  });
});

describe('protected routes', () => {
  it('requires a session for orders, cart checkout and the account area', async () => {
    await request(f.app).get('/api/orders').expect(401);
    await request(f.app).get('/api/account/addresses').expect(401);
    await request(f.app).post('/api/orders').send({ orderType: 'PICKUP', paymentMethod: 'UPI' }).expect(401);
  });

  it('leaves the public menu open to guests', async () => {
    await request(f.app).get('/api/products').expect(200);
    await request(f.app).get('/api/categories').expect(200);
    await request(f.app).get('/api/cafes').expect(200);
  });
});
