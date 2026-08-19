import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/config/prisma';
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

/** Creates an unpaid online order and returns its id. */
async function createOnlineOrder(): Promise<string> {
  await request(f.app)
    .post('/api/cart/items')
    .set(auth(token))
    .send({
      productId: f.coffee.id,
      quantity: 2,
      modifierOptionIds: [f.coffee.sizeMedium, f.coffee.milkOat, f.coffee.sugarNone],
    })
    .expect(201);

  const created = await request(f.app)
    .post('/api/orders')
    .set(auth(token))
    .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'UPI' })
    .expect(201);

  return created.body.order.id as string;
}

describe('payment session', () => {
  it('creates a gateway order for the persisted total', async () => {
    const orderId = await createOnlineOrder();

    const response = await request(f.app)
      .post('/api/payments/create-order')
      .set(auth(token))
      .send({ orderId })
      .expect(201);

    const session = response.body.session;
    expect(session.mode).toBe('mock');
    expect(session.providerOrderId).toBeTruthy();

    // 2 × (210 + 30 + 60) = 600, +5% tax = 630, then grossed up by the 2%
    // gateway fee so the café still nets 630: 630 ÷ 0.98 = 642.86 → 643.
    expect(session.amount).toBe(643);

    // The charged amount, minus what the gateway keeps, is the order value.
    expect(session.amount - session.amount * 0.02).toBeCloseTo(630, 0);
  });

  it('refuses to start an online payment for a cash order', async () => {
    await request(f.app)
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: f.cookieId, quantity: 1, modifierOptionIds: [] })
      .expect(201);

    const cashOrder = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(201);

    const response = await request(f.app)
      .post('/api/payments/create-order')
      .set(auth(token))
      .send({ orderId: cashOrder.body.order.id })
      .expect(400);

    expect(response.body.error.code).toBe('NOT_AN_ONLINE_ORDER');
  });

  it('will not create a session for someone else’s order', async () => {
    const orderId = await createOnlineOrder();
    const { token: otherToken } = await login(f.app, f.otherCustomer.email);

    await request(f.app).post('/api/payments/create-order').set(auth(otherToken)).send({ orderId }).expect(404);
  });
});

describe('signature verification', () => {
  it('rejects a forged signature and leaves the order unpaid', async () => {
    const orderId = await createOnlineOrder();
    const session = (
      await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId }).expect(201)
    ).body.session;

    const response = await request(f.app)
      .post('/api/payments/verify')
      .set(auth(token))
      .send({
        razorpayOrderId: session.providerOrderId,
        razorpayPaymentId: session.mockPaymentId,
        razorpaySignature: 'clearly-not-a-valid-hmac',
      })
      .expect(400);

    expect(response.body.error.code).toBe('SIGNATURE_INVALID');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe('FAILED');
    // A forged signature must never promote the order out of AWAITING_PAYMENT.
    expect(order.orderStatus).toBe('AWAITING_PAYMENT');
  });

  it('rejects a signature that is valid for a different payment id', async () => {
    const orderIdA = await createOnlineOrder();
    const sessionA = (
      await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId: orderIdA }).expect(201)
    ).body.session;

    const orderIdB = await createOnlineOrder();
    const sessionB = (
      await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId: orderIdB }).expect(201)
    ).body.session;

    // Signature from order B replayed against order A must not verify.
    await request(f.app)
      .post('/api/payments/verify')
      .set(auth(token))
      .send({
        razorpayOrderId: sessionA.providerOrderId,
        razorpayPaymentId: sessionA.mockPaymentId,
        razorpaySignature: sessionB.mockSignature,
      })
      .expect(400);
  });

  it('accepts a valid signature and confirms the order', async () => {
    const orderId = await createOnlineOrder();
    const session = (
      await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId }).expect(201)
    ).body.session;

    const response = await request(f.app)
      .post('/api/payments/verify')
      .set(auth(token))
      .send({
        razorpayOrderId: session.providerOrderId,
        razorpayPaymentId: session.mockPaymentId,
        razorpaySignature: session.mockSignature,
      })
      .expect(200);

    expect(response.body.alreadyProcessed).toBe(false);
    expect(response.body.order.paymentStatus).toBe('SUCCESS');
    // A paid order is accepted automatically so it reaches the kitchen.
    expect(response.body.order.orderStatus).toBe('CONFIRMED');
  });

  it('is idempotent when the gateway retries the callback', async () => {
    const orderId = await createOnlineOrder();
    const session = (
      await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId }).expect(201)
    ).body.session;

    const payload = {
      razorpayOrderId: session.providerOrderId,
      razorpayPaymentId: session.mockPaymentId,
      razorpaySignature: session.mockSignature,
    };

    await request(f.app).post('/api/payments/verify').set(auth(token)).send(payload).expect(200);
    const second = await request(f.app).post('/api/payments/verify').set(auth(token)).send(payload).expect(200);

    expect(second.body.alreadyProcessed).toBe(true);

    // Exactly one successful payment row, so revenue can't be double-counted.
    const payments = await prisma.payment.count({ where: { orderId, status: 'SUCCESS' } });
    expect(payments).toBe(1);
  });

  it('will not verify a payment against another customer’s order', async () => {
    const orderId = await createOnlineOrder();
    const session = (
      await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId }).expect(201)
    ).body.session;

    const { token: otherToken } = await login(f.app, f.otherCustomer.email);

    await request(f.app)
      .post('/api/payments/verify')
      .set(auth(otherToken))
      .send({
        razorpayOrderId: session.providerOrderId,
        razorpayPaymentId: session.mockPaymentId,
        razorpaySignature: session.mockSignature,
      })
      .expect(404);
  });
});

describe('failed and retried payments', () => {
  it('records an abandoned attempt', async () => {
    const orderId = await createOnlineOrder();
    const session = (
      await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId }).expect(201)
    ).body.session;

    await request(f.app)
      .post('/api/payments/failed')
      .set(auth(token))
      .send({ razorpayOrderId: session.providerOrderId, reason: 'Customer closed the window' })
      .expect(200);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe('FAILED');
  });

  it('allows a retry after a failure, and the retry can succeed', async () => {
    const orderId = await createOnlineOrder();
    const first = (
      await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId }).expect(201)
    ).body.session;

    await request(f.app)
      .post('/api/payments/failed')
      .set(auth(token))
      .send({ razorpayOrderId: first.providerOrderId })
      .expect(200);

    const retry = (
      await request(f.app).post('/api/payments/retry').set(auth(token)).send({ orderId }).expect(201)
    ).body.session;

    expect(retry.providerOrderId).not.toBe(first.providerOrderId);

    const verified = await request(f.app)
      .post('/api/payments/verify')
      .set(auth(token))
      .send({
        razorpayOrderId: retry.providerOrderId,
        razorpayPaymentId: retry.mockPaymentId,
        razorpaySignature: retry.mockSignature,
      })
      .expect(200);

    expect(verified.body.order.paymentStatus).toBe('SUCCESS');
  });

  it('refuses to charge an order that is already paid', async () => {
    const orderId = await createOnlineOrder();
    const session = (
      await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId }).expect(201)
    ).body.session;

    await request(f.app)
      .post('/api/payments/verify')
      .set(auth(token))
      .send({
        razorpayOrderId: session.providerOrderId,
        razorpayPaymentId: session.mockPaymentId,
        razorpaySignature: session.mockSignature,
      })
      .expect(200);

    const response = await request(f.app)
      .post('/api/payments/create-order')
      .set(auth(token))
      .send({ orderId })
      .expect(409);

    expect(response.body.error.code).toBe('ALREADY_PAID');
  });
});

describe('gateway method availability', () => {
  it('offers every online method while payments are simulated', async () => {
    const response = await request(f.app).get('/api/payments/methods').expect(200);

    expect(response.body.mode).toBe('mock');
    expect(response.body.methods).toEqual(expect.arrayContaining(['UPI', 'CARD', 'NETBANKING']));
  });

  it('is readable without signing in, because Checkout reads it too', async () => {
    await request(f.app).get('/api/payments/methods').expect(200);
  });
});
