import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/config/prisma';
import { auth, disconnect, login, seedFixtures, type Fixtures } from './helpers';

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

/** Creates an order and, unless told otherwise, pays for it. ₹630 total. */
async function createOrder(options: { pay?: boolean; method?: 'UPI' | 'PAY_AT_COUNTER' } = {}) {
  const { pay = true, method = 'UPI' } = options;

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
    .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: method })
    .expect(201);

  const orderId = created.body.order.id as string;

  if (pay && method === 'UPI') {
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
  }

  return { orderId, total: created.body.order.total as number };
}

describe('refundable amount', () => {
  it('reports the full paid amount as refundable', async () => {
    const { orderId, total } = await createOrder();

    const response = await request(f.app)
      .get(`/api/admin/orders/${orderId}/refundable`)
      .set(auth(adminToken))
      .expect(200);

    expect(response.body.refundable).toMatchObject({
      paidAmount: total,
      refundedAmount: 0,
      refundableAmount: total,
      isRefundable: true,
    });
  });

  it('reports nothing refundable on an unpaid cash order', async () => {
    const { orderId } = await createOrder({ pay: false, method: 'PAY_AT_COUNTER' });

    const response = await request(f.app)
      .get(`/api/admin/orders/${orderId}/refundable`)
      .set(auth(adminToken))
      .expect(200);

    expect(response.body.refundable.isRefundable).toBe(false);
    expect(response.body.refundable.reason).toMatch(/never paid/i);
  });
});

describe('issuing a refund', () => {
  it('returns the whole amount and marks the order refunded', async () => {
    const { orderId, total } = await createOrder();

    const response = await request(f.app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set(auth(adminToken))
      .send({ reason: 'Customer changed their mind' })
      .expect(201);

    expect(response.body.refund).toMatchObject({ amount: total, status: 'SUCCESS' });
    expect(response.body.order.paymentStatus).toBe('REFUNDED');
    expect(response.body.order.refundedAmount).toBe(total);
    expect(response.body.refundable.refundableAmount).toBe(0);
  });

  it('supports a partial refund and leaves the rest outstanding', async () => {
    const { orderId, total } = await createOrder();

    const response = await request(f.app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set(auth(adminToken))
      .send({ amount: 100, reason: 'One drink was wrong' })
      .expect(201);

    expect(response.body.refund.amount).toBe(100);
    expect(response.body.order.paymentStatus).toBe('PARTIALLY_REFUNDED');
    expect(response.body.refundable.refundableAmount).toBe(total - 100);
  });

  it('allows topping up a partial refund to the full amount', async () => {
    const { orderId, total } = await createOrder();

    await request(f.app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set(auth(adminToken))
      .send({ amount: 200 })
      .expect(201);

    const second = await request(f.app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set(auth(adminToken))
      .send({})
      .expect(201);

    expect(second.body.refund.amount).toBe(total - 200);
    expect(second.body.order.paymentStatus).toBe('REFUNDED');
    expect(second.body.order.refundedAmount).toBe(total);
  });

  it('refuses to return more than was actually paid', async () => {
    const { orderId, total } = await createOrder();

    const response = await request(f.app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set(auth(adminToken))
      .send({ amount: total + 1 })
      .expect(400);

    expect(response.body.error.code).toBe('REFUND_EXCEEDS_PAYMENT');
  });

  it('refuses a second full refund on an already-refunded order', async () => {
    const { orderId } = await createOrder();

    await request(f.app).post(`/api/admin/orders/${orderId}/refund`).set(auth(adminToken)).send({}).expect(201);

    const second = await request(f.app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set(auth(adminToken))
      .send({})
      .expect(409);

    expect(second.body.error.code).toBe('ALREADY_REFUNDED');
  });

  it('never lets repeated refunds exceed the payment in total', async () => {
    const { orderId, total } = await createOrder();

    // Three attempts at 40% each — the third must be refused, not clipped.
    const slice = Math.floor(total * 0.4);
    await request(f.app).post(`/api/admin/orders/${orderId}/refund`).set(auth(adminToken)).send({ amount: slice }).expect(201);
    await request(f.app).post(`/api/admin/orders/${orderId}/refund`).set(auth(adminToken)).send({ amount: slice }).expect(201);
    await request(f.app).post(`/api/admin/orders/${orderId}/refund`).set(auth(adminToken)).send({ amount: slice }).expect(400);

    const refunded = await prisma.refund.aggregate({ where: { orderId }, _sum: { amount: true } });
    expect(refunded._sum.amount).toBeLessThanOrEqual(total);
  });

  it('refuses a refund on an order that was never paid', async () => {
    const { orderId } = await createOrder({ pay: false, method: 'PAY_AT_COUNTER' });

    const response = await request(f.app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set(auth(adminToken))
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe('NOTHING_TO_REFUND');
  });

  it('records who issued the refund and why', async () => {
    const { orderId } = await createOrder();

    await request(f.app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set(auth(adminToken))
      .send({ reason: 'Machine broke down' })
      .expect(201);

    const refund = await prisma.refund.findFirstOrThrow({ where: { orderId } });
    expect(refund.issuedByUserId).toBe(f.admin.id);
    expect(refund.reason).toBe('Machine broke down');
    expect(refund.providerRefundId).toMatch(/^mock_rfnd_/);
  });
});

describe('automatic refund on cancellation', () => {
  it('returns the money when a paid order is cancelled by the customer', async () => {
    const { orderId, total } = await createOrder();

    const cancelled = await request(f.app).patch(`/api/orders/${orderId}/cancel`).set(auth(token)).expect(200);

    expect(cancelled.body.order.orderStatus).toBe('CANCELLED');
    expect(cancelled.body.order.paymentStatus).toBe('REFUNDED');
    expect(cancelled.body.order.refundedAmount).toBe(total);
  });

  it('returns the money when staff cancel a paid order', async () => {
    const { orderId, total } = await createOrder();

    const cancelled = await request(f.app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set(auth(adminToken))
      .send({ status: 'CANCELLED', note: 'Kitchen ran out' })
      .expect(200);

    expect(cancelled.body.order.paymentStatus).toBe('REFUNDED');
    expect(cancelled.body.order.refundedAmount).toBe(total);

    const refund = await prisma.refund.findFirstOrThrow({ where: { orderId } });
    expect(refund.reason).toBe('Kitchen ran out');
  });

  it('cancels an unpaid order without inventing a refund', async () => {
    const { orderId } = await createOrder({ pay: false, method: 'PAY_AT_COUNTER' });

    const cancelled = await request(f.app).patch(`/api/orders/${orderId}/cancel`).set(auth(token)).expect(200);

    expect(cancelled.body.order.orderStatus).toBe('CANCELLED');
    expect(cancelled.body.order.refundedAmount).toBe(0);
    expect(await prisma.refund.count({ where: { orderId } })).toBe(0);
  });

  it('does not refund twice when a cancelled order is refunded again by hand', async () => {
    const { orderId, total } = await createOrder();

    await request(f.app).patch(`/api/orders/${orderId}/cancel`).set(auth(token)).expect(200);

    await request(f.app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set(auth(adminToken))
      .send({})
      .expect(409);

    const refunded = await prisma.refund.aggregate({ where: { orderId }, _sum: { amount: true } });
    expect(refunded._sum.amount).toBe(total);
  });
});

describe('refund visibility and authorisation', () => {
  it('shows the customer their own refund', async () => {
    const { orderId, total } = await createOrder();
    await request(f.app).patch(`/api/orders/${orderId}/cancel`).set(auth(token)).expect(200);

    const response = await request(f.app).get(`/api/orders/${orderId}`).set(auth(token)).expect(200);

    expect(response.body.order.refundedAmount).toBe(total);
    expect(response.body.order.refunds[0]).toMatchObject({ amount: total, status: 'SUCCESS' });
  });

  it('refuses refunds to customers and to floor staff', async () => {
    const { orderId } = await createOrder();

    await request(f.app).post(`/api/admin/orders/${orderId}/refund`).set(auth(token)).send({}).expect(403);
    await request(f.app).post(`/api/admin/orders/${orderId}/refund`).send({}).expect(401);
    await request(f.app).get(`/api/admin/orders/${orderId}/refundable`).set(auth(token)).expect(403);
  });

  it('will not let one customer see another customer’s refund', async () => {
    const { orderId } = await createOrder();
    await request(f.app).patch(`/api/orders/${orderId}/cancel`).set(auth(token)).expect(200);

    const { token: otherToken } = await login(f.app, f.otherCustomer.email);
    await request(f.app).get(`/api/orders/${orderId}`).set(auth(otherToken)).expect(404);
  });
});
