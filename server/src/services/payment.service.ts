import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import type { PaymentStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { emitOrderEvent } from '../sockets';
import { orderDetailInclude, toOrderSummary, updateStatus } from './order.service';
import { settleRefundFromWebhook } from './refund.service';

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
  /** Which method the customer chose, so Checkout can open on that tab. */
  method: 'upi' | 'card' | 'netbanking' | null;
  /** Prefill for the gateway's own form — never card data, only identity. */
  prefill: { name: string; email: string; contact: string };
  /** Mock mode only: lets the dev UI produce a valid signature to verify. */
  mockPaymentId?: string;
  mockSignature?: string;
}

export type OnlineMethod = 'UPI' | 'CARD' | 'NETBANKING';

const ALL_ONLINE_METHODS: OnlineMethod[] = ['UPI', 'CARD', 'NETBANKING'];
const METHOD_CACHE_MS = 5 * 60_000;

let methodCache: { methods: OnlineMethod[]; fetchedAt: number } | null = null;

/**
 * Which online methods the gateway will actually accept.
 *
 * Method availability is an account setting in the Razorpay dashboard, not
 * something this integration controls. Offering UPI while the account has it
 * switched off strands the customer in a modal that cannot complete, so the
 * checkout asks the gateway rather than assuming. Checkout.js reads this same
 * preferences endpoint, which makes it the authoritative answer, and the short
 * cache means enabling a method in the dashboard takes effect on its own —
 * no redeploy, no code change.
 */
export async function getEnabledOnlineMethods(): Promise<OnlineMethod[]> {
  // Mock mode simulates every method locally, so nothing is withheld.
  if (env.PAYMENT_MODE !== 'razorpay') return ALL_ONLINE_METHODS;

  if (methodCache && Date.now() - methodCache.fetchedAt < METHOD_CACHE_MS) {
    return methodCache.methods;
  }

  try {
    const url = `https://api.razorpay.com/v1/preferences?key_id=${encodeURIComponent(env.RAZORPAY_KEY_ID)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`preferences responded ${response.status}`);

    const body = (await response.json()) as { methods?: Record<string, unknown> };
    const enabled = body.methods ?? {};
    const available = ALL_ONLINE_METHODS.filter((method) => Boolean(enabled[method.toLowerCase()]));

    // An empty list almost certainly means the shape changed rather than that
    // the account takes no payments at all; closing checkout entirely would be
    // the worse failure, so fall back to offering everything.
    const resolved = available.length > 0 ? available : ALL_ONLINE_METHODS;

    methodCache = { methods: resolved, fetchedAt: Date.now() };
    return resolved;
  } catch {
    // A momentarily unreachable gateway must not take the checkout down with
    // it. Serve the last known answer, or assume everything works.
    return methodCache?.methods ?? ALL_ONLINE_METHODS;
  }
}

/** Our payment method names mapped onto Razorpay Checkout's method keys. */
const RAZORPAY_METHOD: Partial<Record<string, 'upi' | 'card' | 'netbanking'>> = {
  UPI: 'upi',
  CARD: 'card',
  NETBANKING: 'netbanking',
};

/**
 * Creates the gateway order. The amount comes from the persisted order total,
 * never from the request body.
 */
export async function createCheckoutSession(orderId: string, userId: string): Promise<CheckoutSession> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });
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
    method: RAZORPAY_METHOD[order.paymentMethod] ?? null,
    // Identity only. Card numbers, CVVs and UPI PINs are collected by the
    // gateway on its own PCI-compliant surface and never touch this server.
    prefill: {
      name: order.contactName || order.user.name,
      email: order.user.email,
      contact: order.contactPhone || order.user.phone,
    },
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

  /**
   * Payment is what makes an intent into an order.
   *
   * An online order sits in AWAITING_PAYMENT — invisible to the kitchen — until
   * this point. Verifying the signature promotes it to PLACED (so it appears on
   * the board and counts as revenue) and then accepts it, which is the moment
   * the customer's tracking page comes alive.
   */
  if (payment.order.orderStatus === 'AWAITING_PAYMENT') {
    await updateStatus(payment.orderId, 'PLACED', { note: 'Payment received', actorRole: 'ADMIN' }).catch(
      () => undefined,
    );
  }

  const confirmed = await updateStatus(payment.orderId, 'CONFIRMED', {
    note: 'Payment confirmed',
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
    payload?: {
      payment?: { entity?: { id: string; order_id: string; error_description?: string } };
      refund?: { entity?: { id: string; status?: string; error_description?: string } };
    };
  };

  // ── refund outcomes ──
  // Razorpay accepts a refund immediately and reports the real result later.
  // This is the authoritative signal that the money actually went back.
  if (event.event === 'refund.processed' || event.event === 'refund.failed') {
    const refundEntity = event.payload?.refund?.entity;
    if (refundEntity?.id) {
      await settleRefundFromWebhook({
        providerRefundId: refundEntity.id,
        status: event.event === 'refund.processed' ? 'SUCCESS' : 'FAILED',
        failureReason: refundEntity.error_description,
      });
    }
    return { received: true };
  }

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

  /**
   * The webhook is the safety net for a customer who paid and then closed the
   * tab before the browser callback fired. It has to be able to promote an
   * order all the way from unpaid to confirmed on its own.
   */
  if (nextStatus === 'SUCCESS') {
    if (order.orderStatus === 'AWAITING_PAYMENT') {
      await updateStatus(order.id, 'PLACED', { note: 'Payment captured', actorRole: 'ADMIN' }).catch(() => undefined);
    }
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
