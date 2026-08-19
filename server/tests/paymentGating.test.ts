import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/config/prisma';
import { auth, disconnect, login, seedFixtures, type Fixtures } from './helpers';

/**
 * The rule under test: an order paid for online is not a real order until the
 * gateway says the money arrived.
 *
 * Until then it must stay out of the kitchen, out of revenue, and out of the
 * fulfilment flow entirely — while remaining recoverable by the customer.
 */

let f: Fixtures;
let token: string;
let adminToken: string;

beforeAll(async () => {
  f = await seedFixtures();
  ({ token } = await login(f.app, f.customer.email));
  ({ token: adminToken } = await login(f.app, f.admin.email));
});

beforeEach(async () => {
  await request(f.app).delete('/api/cart').set(auth(token));
});

afterAll(disconnect);

async function order(method: 'UPI' | 'PAY_AT_COUNTER') {
  await request(f.app)
    .post('/api/cart/items')
    .set(auth(token))
    .send({ productId: f.cookieId, quantity: 2, modifierOptionIds: [] })
    .expect(201);

  const created = await request(f.app)
    .post('/api/orders')
    .set(auth(token))
    .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: method })
    .expect(201);

  return created.body.order as { id: string; orderStatus: string; paymentStatus: string; total: number };
}

async function pay(orderId: string) {
  const session = (
    await request(f.app).post('/api/payments/create-order').set(auth(token)).send({ orderId }).expect(201)
  ).body.session;

  return request(f.app)
    .post('/api/payments/verify')
    .set(auth(token))
    .send({
      razorpayOrderId: session.providerOrderId,
      razorpayPaymentId: session.mockPaymentId,
      razorpaySignature: session.mockSignature,
    })
    .expect(200);
}

describe('an unpaid online order', () => {
  it('is created as AWAITING_PAYMENT, not PLACED', async () => {
    const created = await order('UPI');
    expect(created.orderStatus).toBe('AWAITING_PAYMENT');
    expect(created.paymentStatus).toBe('PENDING');
  });

  it('never reaches the kitchen board', async () => {
    const created = await order('UPI');

    const board = (await request(f.app).get('/api/admin/kitchen/board').set(auth(adminToken)).expect(200)).body.board;
    const allCards = [...board.NEW, ...board.PREPARING, ...board.READY, ...board.COMPLETED];

    expect(allCards.map((card: { id: string }) => card.id)).not.toContain(created.id);
  });

  it('is excluded from revenue', async () => {
    const before = (await request(f.app).get('/api/admin/dashboard').set(auth(adminToken)).expect(200)).body.metrics;
    await order('UPI');
    const after = (await request(f.app).get('/api/admin/dashboard').set(auth(adminToken)).expect(200)).body.metrics;

    expect(after.lifetimeRevenue).toBe(before.lifetimeRevenue);
    expect(after.lifetimeOrders).toBe(before.lifetimeOrders);
  });

  it('cannot be dragged onto the board by staff', async () => {
    const created = await order('UPI');

    const response = await request(f.app)
      .patch(`/api/admin/orders/${created.id}/status`)
      .set(auth(adminToken))
      .send({ status: 'PREPARING' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('shows the customer a payment step rather than a fake timeline', async () => {
    const created = await order('UPI');

    const tracking = await request(f.app).get(`/api/orders/${created.id}/tracking`).set(auth(token)).expect(200);

    expect(tracking.body.awaitingPayment).toBe(true);
    expect(tracking.body.steps).toHaveLength(1);
    expect(tracking.body.steps[0].status).toBe('AWAITING_PAYMENT');
  });

  it('can still be cancelled by the customer', async () => {
    const created = await order('UPI');
    const cancelled = await request(f.app).patch(`/api/orders/${created.id}/cancel`).set(auth(token)).expect(200);

    expect(cancelled.body.order.orderStatus).toBe('CANCELLED');
    // Nothing was ever captured, so there is nothing to refund.
    expect(cancelled.body.order.refundedAmount).toBe(0);
  });
});

describe('once payment is verified', () => {
  it('becomes a real, confirmed order', async () => {
    const created = await order('UPI');
    const paid = await pay(created.id);

    expect(paid.body.order.paymentStatus).toBe('SUCCESS');
    expect(paid.body.order.orderStatus).toBe('CONFIRMED');
  });

  it('appears on the kitchen board', async () => {
    const created = await order('UPI');
    await pay(created.id);

    const board = (await request(f.app).get('/api/admin/kitchen/board').set(auth(adminToken)).expect(200)).body.board;
    const allCards = [...board.NEW, ...board.PREPARING, ...board.READY, ...board.COMPLETED];

    expect(allCards.map((card: { id: string }) => card.id)).toContain(created.id);
  });

  it('counts towards revenue', async () => {
    const before = (await request(f.app).get('/api/admin/dashboard').set(auth(adminToken)).expect(200)).body.metrics;
    const created = await order('UPI');
    await pay(created.id);
    const after = (await request(f.app).get('/api/admin/dashboard').set(auth(adminToken)).expect(200)).body.metrics;

    expect(after.lifetimeRevenue).toBe(before.lifetimeRevenue + created.total);
  });

  it('records the promotion in the order history', async () => {
    const created = await order('UPI');
    await pay(created.id);

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: created.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(history.map((entry) => entry.status)).toEqual(['AWAITING_PAYMENT', 'PLACED', 'CONFIRMED']);
  });
});

describe('cash orders are unaffected', () => {
  it('are placed immediately and reach the kitchen', async () => {
    const created = await order('PAY_AT_COUNTER');
    expect(created.orderStatus).toBe('PLACED');

    const board = (await request(f.app).get('/api/admin/kitchen/board').set(auth(adminToken)).expect(200)).body.board;
    const allCards = [...board.NEW, ...board.PREPARING, ...board.READY, ...board.COMPLETED];

    expect(allCards.map((card: { id: string }) => card.id)).toContain(created.id);
  });
});
