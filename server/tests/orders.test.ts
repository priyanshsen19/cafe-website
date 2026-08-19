import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/config/prisma';
import { auth, disconnect, login, seedFixtures, type Fixtures } from './helpers';

let f: Fixtures;
let token: string;
let adminToken: string;
let addressId: string;

beforeAll(async () => {
  f = await seedFixtures();
  ({ token } = await login(f.app, f.customer.email));
  ({ token: adminToken } = await login(f.app, f.admin.email));

  const addresses = await request(f.app).get('/api/account/addresses').set(auth(token)).expect(200);
  addressId = addresses.body.addresses[0].id;
});

beforeEach(async () => {
  await request(f.app).delete('/api/cart').set(auth(token));
});

afterAll(disconnect);

/** Puts ₹700 of coffee in the cart (2 × ₹350). */
async function fillCart() {
  await request(f.app)
    .post('/api/cart/items')
    .set(auth(token))
    .send({
      productId: f.coffee.id,
      quantity: 2,
      modifierOptionIds: [f.coffee.sizeMedium, f.coffee.milkOat, f.coffee.sugarNone, f.coffee.extraShot],
    })
    .expect(201);
}

describe('placing an order', () => {
  it('creates a delivery order with server-computed totals', async () => {
    await fillCart();

    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'DELIVERY', addressId, paymentMethod: 'COD' })
      .expect(201);

    const order = response.body.order;
    expect(order.orderNumber).toMatch(/^CA-\d+$/);
    expect(order.subtotal).toBe(700);
    expect(order.tax).toBe(35);
    expect(order.deliveryFee).toBe(0); // 700 ≥ 499 threshold
    expect(order.total).toBe(735);
    expect(order.orderStatus).toBe('PLACED');
    expect(order.deliveryAddress).not.toBeNull();
  });

  it('snapshots the dish name and price onto the order', async () => {
    await fillCart();

    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(201);

    const item = response.body.order.items[0];
    expect(item.name).toBe('Cappuccino');
    expect(item.unitPrice).toBe(350);
    expect(item.modifierSummary).toContain('Oat Milk');
  });

  it('keeps historical prices even after the menu changes', async () => {
    await fillCart();

    const created = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(201);

    // The café puts the price up after the order was placed.
    await prisma.product.update({ where: { id: f.coffee.id }, data: { basePrice: 999 } });

    const reread = await request(f.app).get(`/api/orders/${created.body.order.id}`).set(auth(token)).expect(200);
    expect(reread.body.order.items[0].unitPrice).toBe(350);
    expect(reread.body.order.total).toBe(created.body.order.total);

    await prisma.product.update({ where: { id: f.coffee.id }, data: { basePrice: 210 } });
  });

  it('empties the cart once the order exists', async () => {
    await fillCart();
    await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(201);

    const cart = await request(f.app).get('/api/cart').set(auth(token)).expect(200);
    expect(cart.body.cart.lines).toHaveLength(0);
  });

  it('refuses to check out an empty cart', async () => {
    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(400);

    expect(response.body.error.code).toBe('CART_EMPTY');
  });

  it('blocks checkout when an item went out of stock after it was added', async () => {
    await request(f.app)
      .post('/api/cart/items')
      .set(auth(token))
      .send({ productId: f.cookieId, quantity: 1, modifierOptionIds: [] })
      .expect(201);

    // The kitchen runs out while the customer is at checkout.
    await prisma.product.update({ where: { id: f.cookieId }, data: { isAvailable: false } });

    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(422);

    expect(response.body.error.code).toBe('ITEM_UNAVAILABLE');

    await prisma.product.update({ where: { id: f.cookieId }, data: { isAvailable: true } });
  });

  it('applies a coupon server-side and records its use', async () => {
    await fillCart();

    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER', couponCode: 'TEST10' })
      .expect(201);

    expect(response.body.order.discount).toBe(70);
    expect(response.body.order.couponCode).toBe('TEST10');

    const usage = await prisma.couponUsage.count({ where: { userId: f.customer.id } });
    expect(usage).toBe(1);
  });

  it('refuses a coupon the customer has already redeemed', async () => {
    await fillCart();

    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER', couponCode: 'TEST10' })
      .expect(400);

    expect(response.body.error.code).toBe('COUPON_ALREADY_USED');
  });
});

describe('order types', () => {
  it('creates a dine-in order from a scanned table token', async () => {
    await fillCart();

    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'DINE_IN', tableToken: f.tableToken, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(201);

    expect(response.body.order.table.label).toBe('T01');
    expect(response.body.order.deliveryFee).toBe(0);
    expect(response.body.order.deliveryAddress).toBeNull();
  });

  it('marks the table occupied once a dine-in order lands', async () => {
    const table = await prisma.cafeTable.findFirst({ where: { qrToken: f.tableToken } });
    expect(table?.status).toBe('OCCUPIED');
  });

  it('requires an address for delivery', async () => {
    await fillCart();
    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'DELIVERY', paymentMethod: 'COD' })
      .expect(422);

    expect(response.body.error.details).toHaveProperty('addressId');
  });

  it('requires a café for pickup', async () => {
    await fillCart();
    await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', paymentMethod: 'PAY_AT_COUNTER' })
      .expect(422);
  });

  it('requires a table token for dine-in', async () => {
    await fillCart();
    await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'DINE_IN', paymentMethod: 'PAY_AT_COUNTER' })
      .expect(422);
  });

  it('rejects an address belonging to another customer', async () => {
    await fillCart();
    const otherAddress = await prisma.address.create({
      data: {
        userId: f.otherCustomer.id,
        fullName: 'Someone Else',
        phone: '+91 90000 00002',
        line1: '1 Other Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400050',
      },
    });

    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'DELIVERY', addressId: otherAddress.id, paymentMethod: 'COD' })
      .expect(404);

    expect(response.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it('rejects a fabricated table token', async () => {
    await fillCart();
    await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'DINE_IN', tableToken: 'made-up-token', paymentMethod: 'PAY_AT_COUNTER' })
      .expect(404);
  });
});

describe('payment method rules', () => {
  it('refuses cash on delivery for a dine-in order', async () => {
    await fillCart();
    const response = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'DINE_IN', tableToken: f.tableToken, paymentMethod: 'COD' })
      .expect(400);

    expect(response.body.error.code).toBe('PAYMENT_METHOD_INVALID');
  });

  it('refuses pay-at-counter for a delivery order', async () => {
    await fillCart();
    await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'DELIVERY', addressId, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(400);
  });
});

describe('order lifecycle', () => {
  let orderId: string;

  beforeEach(async () => {
    await fillCart();
    const created = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(201);
    orderId = created.body.order.id;
  });

  it('builds a tracking timeline for the order type', async () => {
    const response = await request(f.app).get(`/api/orders/${orderId}/tracking`).set(auth(token)).expect(200);

    const labels = response.body.steps.map((step: { status: string }) => step.status);
    expect(labels).toEqual(['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'COLLECTED']);
    expect(response.body.steps[0].isComplete).toBe(true);
    expect(response.body.steps[0].isCurrent).toBe(true);
  });

  it('lets staff advance the order and refuses to move it backwards', async () => {
    await request(f.app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set(auth(adminToken))
      .send({ status: 'PREPARING' })
      .expect(200);

    const back = await request(f.app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set(auth(adminToken))
      .send({ status: 'CONFIRMED' })
      .expect(400);

    expect(back.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('settles a pay-at-counter bill when the order completes', async () => {
    await request(f.app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set(auth(adminToken))
      .send({ status: 'READY' })
      .expect(200);

    const done = await request(f.app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set(auth(adminToken))
      .send({ status: 'COLLECTED' })
      .expect(200);

    expect(done.body.order.paymentStatus).toBe('SUCCESS');
  });

  it('lets the customer cancel while it is still early', async () => {
    const response = await request(f.app).patch(`/api/orders/${orderId}/cancel`).set(auth(token)).expect(200);
    expect(response.body.order.orderStatus).toBe('CANCELLED');
  });

  it('refuses cancellation once the order is ready', async () => {
    await request(f.app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set(auth(adminToken))
      .send({ status: 'READY' })
      .expect(200);

    const response = await request(f.app).patch(`/api/orders/${orderId}/cancel`).set(auth(token)).expect(400);
    expect(response.body.error.code).toBe('CANNOT_CANCEL');
  });

  it('reorders at current prices and reports what changed', async () => {
    await request(f.app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set(auth(adminToken))
      .send({ status: 'READY' })
      .expect(200);
    await request(f.app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set(auth(adminToken))
      .send({ status: 'COLLECTED' })
      .expect(200);

    await request(f.app).delete('/api/cart').set(auth(token));
    await prisma.product.update({ where: { id: f.coffee.id }, data: { basePrice: 260 } });

    const response = await request(f.app).post(`/api/orders/${orderId}/reorder`).set(auth(token)).expect(200);

    expect(response.body.added).toContain('Cappuccino');
    // The old ₹350 unit price must not be reused — 260 + 30 + 60 + 50 = 400.
    expect(response.body.cart.lines[0].unitPrice).toBe(400);
    expect(response.body.repriced[0]).toMatchObject({ was: 350, now: 400 });

    await prisma.product.update({ where: { id: f.coffee.id }, data: { basePrice: 210 } });
  });
});

describe('order ownership', () => {
  let orderId: string;

  beforeAll(async () => {
    await request(f.app).delete('/api/cart').set(auth(token));
    await fillCart();
    const created = await request(f.app)
      .post('/api/orders')
      .set(auth(token))
      .send({ orderType: 'PICKUP', cafeId: f.cafeId, paymentMethod: 'PAY_AT_COUNTER' })
      .expect(201);
    orderId = created.body.order.id;
  });

  it('hides another customer’s order behind a 404', async () => {
    const { token: otherToken } = await login(f.app, f.otherCustomer.email);

    await request(f.app).get(`/api/orders/${orderId}`).set(auth(otherToken)).expect(404);
    await request(f.app).get(`/api/orders/${orderId}/tracking`).set(auth(otherToken)).expect(404);
    await request(f.app).patch(`/api/orders/${orderId}/cancel`).set(auth(otherToken)).expect(404);
  });

  it('lets staff see any order', async () => {
    await request(f.app).get(`/api/orders/${orderId}`).set(auth(adminToken)).expect(200);
  });

  it('only lists the requesting customer’s own orders', async () => {
    const { token: otherToken } = await login(f.app, f.otherCustomer.email);
    const response = await request(f.app).get('/api/orders').set(auth(otherToken)).expect(200);

    const ids = response.body.orders.map((order: { id: string }) => order.id);
    expect(ids).not.toContain(orderId);
  });
});

describe('admin authorisation', () => {
  it('blocks a customer from every admin endpoint', async () => {
    await request(f.app).get('/api/admin/dashboard').set(auth(token)).expect(403);
    await request(f.app).get('/api/admin/products').set(auth(token)).expect(403);
    await request(f.app).get('/api/admin/customers').set(auth(token)).expect(403);
    await request(f.app).get('/api/admin/kitchen/board').set(auth(token)).expect(403);
  });

  it('blocks anonymous access to admin endpoints', async () => {
    await request(f.app).get('/api/admin/dashboard').expect(401);
  });

  it('allows an admin through', async () => {
    await request(f.app).get('/api/admin/dashboard').set(auth(adminToken)).expect(200);
    await request(f.app).get('/api/admin/kitchen/board').set(auth(adminToken)).expect(200);
  });

  it('never exposes authentication material in the customer list', async () => {
    const response = await request(f.app).get('/api/admin/customers').set(auth(adminToken)).expect(200);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});
