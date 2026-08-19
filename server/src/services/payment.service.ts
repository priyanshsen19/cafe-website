import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import type { PaymentStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { emitOrderEvent } from '../sockets';
import { orderDetailInclude, toOrderSummary, updateStatus } from './order.service';

/**
 * Payment integrity rests on one rule: the browser is never believed. The
 * client can only hand back what the gateway gave it, and we recompute the
 * HMAC ourselves before a single rupee is marked as received.
 *
 * In `PAYMENT_MODE=mock` the same verification path runs against a locally
 * generated signature, so the development flow exercises the real code rather
 * than bypassing it. Mock mode cannot be enabled in production (see config/env).
 */

const MOCK_SECRET_SALT = 'alaap-mock-gateway';

function razorpayClient(): Razorpay {
  if (env.PAYMENT_MODE !== 'razorpay') {
    throw AppError.badRequest('Online payments are not configured.', 'PAYMENT_NOT_CONFIGURED');
  }
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

/** The secret used to sign/verify. Mock mode derives one from the JWT secret. */
function signingSecret(): string {
  return env.PAYMENT_MODE === 'razorpay'
    ? env.RAZORPAY_KEY_SECRET
    : crypto.createHash('sha256').update(env.JWT_SECRET + MOCK_SECRET_SALT).digest('hex');
}

function expectedSignature(providerOrderId: string, providerPaymentId: string): string {
  return crypto
    .createHmac('sha256', signingSecret())
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest('hex');
}

/** Constant-time compare so signature checking can't be timed. */
function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export interface CheckoutSession {
  mode: 'razorpay' | 'mock';
  keyId: string | null;
  providerOrderId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  /** Mock mode only: lets the dev UI produce a valid signature to verify. */
  mockPaymentId?: string;
  mockSignature?: string;
}

/**
 * Creates the gateway order. The amount comes from the persisted order total,
 * never from the request body.
 */
export async function createCheckoutSession(orderId: string, userId: string): Promise<CheckoutSession> {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw AppError.notFound('We couldn’t find that order.', 'ORDER_NOT_FOUND');

  if (order.paymentStatus === 'SUCCESS') {
    throw AppError.conflict('This order is already paid.', 'ALREADY_PAID');
  }
  if (order.paymentMethod === 'COD' || order.paymentMethod === 'PAY_AT_COUNTER') {
    throw AppError.badRequest('This order is settled in person.', 'NOT_AN_ONLINE_ORDER');
  }
  if (order.orderStatus === 'CANCELLED') {
    throw AppError.badRequest('This order was cancelled.', 'ORDER_CANCELLED');
  }

  // Razorpay works in the smallest currency unit.
  const amountInPaise = order.total * 100;

  let providerOrderId: string;

  if (env.PAYMENT_MODE === 'razorpay') {
    const created = await razorpayClient().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderId: order.id, orderNumber: order.orderNumber },
    });
    providerOrderId = created.id;
  } else {
    providerOrderId = `mock_order_${crypto.randomBytes(8).toString('hex')}`;
  }

  await prisma.payment.updateMany({
    where: { orderId: order.id, status: { in: ['PENDING', 'FAILED'] } },
    data: {
      provider: env.PAYMENT_MODE === 'razorpay' ? 'RAZORPAY' : 'MOCK',
      providerOrderId,
      status: 'PROCESSING',
      amount: order.total,
    },
  });

  await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PROCESSING' } });

  const session: CheckoutSession = {
    mode: env.PAYMENT_MODE,
    keyId: env.PAYMENT_MODE === 'razorpay' ? env.RAZORPAY_KEY_ID : null,
    providerOrderId,
    amount: order.total,
    currency: 'INR',
    orderNumber: order.orderNumber,
  };

  if (env.PAYMENT_MODE === 'mock') {
    const mockPaymentId = `mock_pay_${crypto.randomBytes(8).toString('hex')}`;
    session.mockPaymentId = mockPaymentId;
    session.mockSignature = expectedSignature(providerOrderId, mockPaymentId);
  }

  return session;
}

export interface VerifyInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/**
 * Verifies a gateway callback and settles the order. Safe to call twice — a
 * duplicate callback for an already-successful payment is a no-op.
 */
export async function verifyPayment(input: VerifyInput, userId: string) {
  const payment = await prisma.payment.findFirst({
    where: { providerOrderId: input.razorpayOrderId, order: { userId } },
    include: { order: true },
  });

  if (!payment) throw AppError.notFound('We couldn’t match that payment.', 'PAYMENT_NOT_FOUND');

  // Idempotency: gateways retry, and users double-click.
  if (payment.status === 'SUCCESS') {
    const settled = await prisma.order.findUniqueOrThrow({
      where: { id: payment.orderId },
      include: orderDetailInclude,
    });
    return { alreadyProcessed: true, order: toOrderSummary(settled) };
  }

  const expected = expectedSignature(input.razorpayOrderId, input.razorpayPaymentId);

  if (!signaturesMatch(expected, input.razorpaySignature)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failureReason: 'Signature verification failed' },
    });
    await prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'FAILED' } });

    throw AppError.badRequest(
      'We couldn’t verify that payment. No money has been captured — please try again.',
      'SIGNATURE_INVALID',
    );
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentId: input.razorpayPaymentId,
      providerSignature: input.razorpaySignature,
      status: 'SUCCESS',
      failureReason: null,
    },
  });

  await prisma.order.update({
    where: { id: payment.orderId },
    data: { paymentStatus: 'SUCCESS' },
  });

  // A paid order is accepted automatically so it reaches the kitchen board.
  const confirmed = await updateStatus(payment.orderId, 'CONFIRMED', {
    note: 'Payment received',
    actorRole: 'ADMIN',
  }).catch(async () => {
    return prisma.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: orderDetailInclude });
  });

  return { alreadyProcessed: false, order: toOrderSummary(confirmed) };
}

/** Records an abandoned or gateway-failed attempt so the customer can retry. */
export async function markFailed(providerOrderId: string, userId: string, reason?: string) {
  const payment = await prisma.payment.findFirst({
    where: { providerOrderId, order: { userId } },
  });
  if (!payment) throw AppError.notFound('We couldn’t match that payment.', 'PAYMENT_NOT_FOUND');
  if (payment.status === 'SUCCESS') return { ok: true };

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'FAILED', failureReason: reason?.slice(0, 200) ?? 'Payment was not completed' },
  });
  await prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'FAILED' } });

  return { ok: true };
}

/**
 * Server-to-server webhook. Verified against the raw request body with the
 * dedicated webhook secret — this is the authoritative signal, since a customer
 * can always close their browser before the client callback fires.
 */
export async function handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
  if (env.PAYMENT_MODE !== 'razorpay') {
    throw AppError.badRequest('Webhooks are only active with a real gateway.', 'WEBHOOK_DISABLED');
  }
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw AppError.badRequest('Webhook secret is not configured.', 'WEBHOOK_NOT_CONFIGURED');
  }
  if (!rawBody || !signature) {
    throw AppError.badRequest('Malformed webhook.', 'WEBHOOK_MALFORMED');
  }

  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  if (!signaturesMatch(expected, signature)) {
    throw AppError.unauthorized('Invalid webhook signature.', 'WEBHOOK_SIGNATURE_INVALID');
  }

  const event = JSON.parse(rawBody.toString('utf8')) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; error_description?: string } } };
  };

  const entity = event.payload?.payment?.entity;
  if (!entity?.order_id) return { received: true };

  const payment = await prisma.payment.findFirst({ where: { providerOrderId: entity.order_id } });
  if (!payment) return { received: true };

  const nextStatus: PaymentStatus | null =
    event.event === 'payment.captured' ? 'SUCCESS' : event.event === 'payment.failed' ? 'FAILED' : null;

  if (!nextStatus || payment.status === 'SUCCESS') return { received: true };

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: nextStatus,
      providerPaymentId: entity.id,
      failureReason: nextStatus === 'FAILED' ? (entity.error_description ?? 'Payment failed') : null,
    },
  });

  const order = await prisma.order.update({
    where: { id: payment.orderId },
    data: { paymentStatus: nextStatus },
    include: orderDetailInclude,
  });

  if (nextStatus === 'SUCCESS' && order.orderStatus === 'PLACED') {
    await updateStatus(order.id, 'CONFIRMED', { note: 'Payment captured', actorRole: 'ADMIN' }).catch(() => undefined);
  } else {
    emitOrderEvent('order:updated', order, toOrderSummary(order));
  }

  return { received: true };
}

/** Retry an online payment on an order that previously failed. */
export async function retryPayment(orderId: string, userId: string): Promise<CheckoutSession> {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw AppError.notFound('We couldn’t find that order.', 'ORDER_NOT_FOUND');
  if (order.paymentStatus === 'SUCCESS') throw AppError.conflict('This order is already paid.', 'ALREADY_PAID');

  return createCheckoutSession(orderId, userId);
}
