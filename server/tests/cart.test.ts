import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, disconnect, login, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
let token: string;

beforeAll(async () => {
  f = await seedFixtures();
  ({ token } = await login(f.app, f.customer.email));
});

beforeEach(async () => {
  await request(f.app).delete('/api/cart').set(auth(token));
});

afterAll(disconnect);

const addCoffee = (quantity = 1, extraOptions: string[] = []) =>
  request(f.app)
    .post('/api/cart/items')
    .set(auth(token))
    .send({
      productId: f.coffee.id,
      quantity,
      modifierOptionIds: [f.coffee.sizeMedium, f.coffee.milkOat, f.coffee.sugarNone, ...extraOptions],
    });

describe('adding items', () => {
  it('prices modifiers on the server', async () => {
    const response = await addCoffee(2, [f.coffee.extraShot]).expect(201);
    const line = response.body.cart.lines[0];

    // 210 base + 30 Medium + 60 Oat + 50 Extra shot = 350
    expect(line.unitPrice).toBe(350);
    expect(line.subtotal).toBe(700);
    expect(response.body.cart.totals.subtotal).toBe(700);
  });

  it('records the chosen customisation for the kitchen', async () => {
    const response = await addCoffee(1, [f.coffee.extraShot]).expect(201);
    expect(response.body.cart.lines[0].modifierSummary).toBe('Medium · Oat Milk · No Sugar · Extra Espresso Shot');
  });

  it('rejects an item that is missing a required choice', async () => {
    const response = await request(f.app)
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: f.coffee.id, quantity: 1, modifierOptionIds: [] })
      .expect(400);

    expect(response.body.error.code).toBe('MISSING_MODIFIER');
  });

  it('refuses a dish the kitchen has marked unavailable', async () => {
    const response = await request(f.app)
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: f.soldOutId, quantity: 1, modifierOptionIds: [] })
      .expect(422);

    expect(response.body.error.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('refuses an unknown product', async () => {
    await request(f.app)
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: 'does-not-exist', quantity: 1, modifierOptionIds: [] })
      .expect(404);
  });

  it('merges an identical line instead of duplicating it', async () => {
    await addCoffee(1).expect(201);
    const response = await addCoffee(2).expect(201);

    expect(response.body.cart.lines).toHaveLength(1);
    expect(response.body.cart.lines[0].quantity).toBe(3);
  });

  it('keeps differently customised lines separate', async () => {
    await addCoffee(1).expect(201);
    const response = await addCoffee(1, [f.coffee.extraShot]).expect(201);

    expect(response.body.cart.lines).toHaveLength(2);
  });

  it('sums a multi-item cart correctly', async () => {
    await addCoffee(2, [f.coffee.extraShot]).expect(201); // 350 × 2 = 700
    const response = await request(f.app)
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: f.cookieId, quantity: 3, modifierOptionIds: [] }) // 150 × 3 = 450
      .expect(201);

    expect(response.body.cart.totals.subtotal).toBe(1150);
    expect(response.body.cart.itemCount).toBe(5);
  });
});

describe('updating items', () => {
  it('changes quantity and recomputes the total', async () => {
    const added = await addCoffee(1).expect(201);
    const itemId = added.body.cart.lines[0].id;

    const response = await request(f.app)
      .patch(`/api/cart/items/${itemId}`)
      .set(auth(token))
      .send({ quantity: 4 })
      .expect(200);

    expect(response.body.cart.lines[0].quantity).toBe(4);
    expect(response.body.cart.totals.subtotal).toBe(300 * 4);
  });

  it('removes the line when quantity drops to zero', async () => {
    const added = await addCoffee(1).expect(201);
    const itemId = added.body.cart.lines[0].id;

    const response = await request(f.app)
      .patch(`/api/cart/items/${itemId}`)
      .set(auth(token))
      .send({ quantity: 0 })
      .expect(200);

    expect(response.body.cart.lines).toHaveLength(0);
  });

  it('removes a line explicitly', async () => {
    const added = await addCoffee(1).expect(201);
    const itemId = added.body.cart.lines[0].id;

    const response = await request(f.app).delete(`/api/cart/items/${itemId}`).set(auth(token)).expect(200);
    expect(response.body.cart.lines).toHaveLength(0);
  });

  it('empties the whole cart', async () => {
    await addCoffee(2).expect(201);
    const response = await request(f.app).delete('/api/cart').set(auth(token)).expect(200);

    expect(response.body.cart.lines).toHaveLength(0);
    expect(response.body.cart.totals.total).toBe(0);
  });
});

describe('cart ownership', () => {
  it('will not let one customer mutate another customer’s line', async () => {
    const added = await addCoffee(1).expect(201);
    const itemId = added.body.cart.lines[0].id;

    const { token: otherToken } = await login(f.app, f.otherCustomer.email);

    // A valid quantity, so it is ownership — not validation — that rejects this.
    await request(f.app)
      .patch(`/api/cart/items/${itemId}`)
      .set(auth(otherToken))
      .send({ quantity: 5 })
      .expect(404);

    await request(f.app).delete(`/api/cart/items/${itemId}`).set(auth(otherToken)).expect(404);
  });

  it('keeps each customer’s cart separate', async () => {
    await addCoffee(1).expect(201);

    const { token: otherToken } = await login(f.app, f.otherCustomer.email);
    const response = await request(f.app).get('/api/cart').set(auth(otherToken)).expect(200);

    expect(response.body.cart.lines).toHaveLength(0);
  });
});

describe('cart totals by order type', () => {
  it('charges delivery below the threshold but not for pickup', async () => {
    await addCoffee(1).expect(201); // ₹300

    const delivery = await request(f.app).get('/api/cart?orderType=DELIVERY').set(auth(token)).expect(200);
    const pickup = await request(f.app).get('/api/cart?orderType=PICKUP').set(auth(token)).expect(200);

    expect(delivery.body.cart.totals.deliveryFee).toBe(49);
    expect(pickup.body.cart.totals.deliveryFee).toBe(0);
  });

  it('applies a valid coupon to the server-side subtotal', async () => {
    await addCoffee(2, [f.coffee.extraShot]).expect(201); // ₹700

    const response = await request(f.app)
      .get('/api/cart?orderType=PICKUP&couponCode=TEST10')
      .set(auth(token))
      .expect(200);

    expect(response.body.cart.coupon.code).toBe('TEST10');
    expect(response.body.cart.totals.discount).toBe(70);
  });

  it('silently ignores an invalid coupon rather than breaking the cart', async () => {
    await addCoffee(1).expect(201);

    const response = await request(f.app)
      .get('/api/cart?orderType=PICKUP&couponCode=NOPE')
      .set(auth(token))
      .expect(200);

    expect(response.body.cart.coupon).toBeNull();
    expect(response.body.cart.totals.discount).toBe(0);
  });
});

describe('guest carts', () => {
  it('lets a guest build a cart, then merges it on sign-in', async () => {
    const agent = request.agent(f.app);

    // Guest adds a cookie — the session cookie is issued automatically.
    await agent.post('/api/cart/items').send({ productId: f.cookieId, quantity: 2, modifierOptionIds: [] }).expect(201);

    const guestCart = await agent.get('/api/cart').expect(200);
    expect(guestCart.body.cart.itemCount).toBe(2);

    // Sign in on the same agent so the guest session cookie travels with it.
    const signedIn = await agent
      .post('/api/auth/login')
      .send({ email: f.otherCustomer.email, password: 'TestPass123!' })
      .expect(200);

    // The merged contents now belong to the account, so read them as that user.
    const merged = await agent
      .get('/api/cart')
      .set(auth(signedIn.body.accessToken as string))
      .expect(200);

    expect(merged.body.cart.itemCount).toBeGreaterThanOrEqual(2);

    // And the anonymous cart is gone rather than left behind as a duplicate.
    const guestAfter = await agent.get('/api/cart').expect(200);
    expect(guestAfter.body.cart.lines).toHaveLength(0);
  });
});
