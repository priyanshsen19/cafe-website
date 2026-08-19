import Razorpay from 'razorpay';
import type { Prisma, Refund } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { formatINR } from '../utils/money';

/**
 * Refunds.
 *
 * Two rules shape everything here:
 *
 * 1. We only ever return money we actually took. The refundable ceiling is the
 *    captured amount minus everything already refunded or in flight, so a
 *    double-click, a retried request, or two staff acting at once can never
 *    return more than the customer paid.
 * 2. A refund is a record, not a flag. Each one is its own row with its own
 *    gateway id and status, because real refunds are asynchronous and can fail
 *    after being accepted — and because a café will sometimes return only part
 *    of a bill.
 */

/** Refunds that count against the ceiling — failed ones free their amount up. */
const CONSUMING: Refund['status'][] = ['PENDING', 'PROCESSING', 'SUCCESS'];

export interface RefundableSummary {
  /** The captured payment, if there is one. */
  paymentId: string | null;
  paidAmount: number;
  refundedAmount: number;
  refundableAmount: number;
  isRefundable: boolean;
  /** Why a refund isn't possible, phrased for staff. */
  reason: string | null;
}

/**
 * Works out what — if anything — can be returned on an order. Cash orders that
 * were never collected have nothing to refund, which is a normal outcome rather
 * than an error.
 */
export async function getRefundable(orderId: string): Promise<RefundableSummary> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: { orderBy: { createdAt: 'desc' } },
      refunds: true,
    },
  });

  if (!order) throw AppError.notFound('We couldn’t find that order.', 'ORDER_NOT_FOUND');

  const captured = order.payments.find((payment) => payment.status === 'SUCCESS');

  const refundedAmount = order.refunds
    .filter((refund) => CONSUMING.includes(refund.status))
    .reduce((sum, refund) => sum + refund.amount, 0);

  if (!captured) {
    return {
      paymentId: null,
      paidAmount: 0,
      refundedAmount,
      refundableAmount: 0,
      isRefundable: false,
      reason:
        order.paymentMethod === 'COD' || order.paymentMethod === 'PAY_AT_COUNTER'
          ? 'This order was never paid — there is nothing to return.'
          : 'No payment was captured for this order.',
    };
  }

  const refundableAmount = Math.max(0, captured.amount - refundedAmount);

  return {
    paymentId: captured.id,
    paidAmount: captured.amount,
    refundedAmount,
    refundableAmount,
    isRefundable: refundableAmount > 0,
    reason: refundableAmount > 0 ? null : 'This order has already been fully refunded.',
  };
}

/** Asks the gateway to return the money. Mock mode simulates a refund id. */
async function executeAtGateway(input: {
  provider: Refund['provider'];
  providerPaymentId: string | null;
  amount: number;
}): Promise<{ providerRefundId: string | null; status: Refund['status']; failureReason?: string }> {
  // Cash is handed back across the counter; there is no gateway involved.
  if (input.provider === 'CASH') {
    return { providerRefundId: null, status: 'SUCCESS' };
  }

  if (env.PAYMENT_MODE === 'razorpay' && input.provider === 'RAZORPAY') {
    if (!input.providerPaymentId) {
      return { providerRefundId: null, status: 'FAILED', failureReason: 'No gateway payment id on record' };
    }

    try {
      const client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
      // Razorpay works in the smallest currency unit.
      const created = await client.payments.refund(input.providerPaymentId, { amount: input.amount * 100 });

      return {
        providerRefundId: created.id,
        // Razorpay reports `processed` once the money has left; anything else is
        // still in flight and will be settled by the webhook.
        status: created.status === 'processed' ? 'SUCCESS' : 'PROCESSING',
      };
    } catch (error) {
      return {
        providerRefundId: null,
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message.slice(0, 200) : 'Gateway refused the refund',
      };
    }
  }

  // Development gateway: settles immediately so the flow is demonstrable.
  return {
    providerRefundId: `mock_rfnd_${Math.random().toString(16).slice(2, 12)}`,
    status: 'SUCCESS',
  };
}

/**
 * Recomputes the *order's* payment status from the refunds that now exist.
 *
 * The Payment row is deliberately left as SUCCESS. A capture either happened or
 * it didn't — that's a historical fact, and it is how we locate the money to
 * refund against. Overwriting it would erase the very record later refunds need
 * to find, so refund state lives on the order and in the Refund rows instead.
 */
async function syncPaymentStatus(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const [payments, refunds] = await Promise.all([
    tx.payment.findMany({ where: { orderId } }),
    tx.refund.findMany({ where: { orderId } }),
  ]);

  const captured = payments.find((payment) => payment.status === 'SUCCESS');
  if (!captured) return;

  const returned = refunds
    .filter((refund) => CONSUMING.includes(refund.status))
    .reduce((sum, refund) => sum + refund.amount, 0);

  const status = returned <= 0 ? 'SUCCESS' : returned >= captured.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

  await tx.order.update({ where: { id: orderId }, data: { paymentStatus: status } });
}

export interface IssueRefundInput {
  orderId: string;
  /** Omit for a full refund of whatever remains. */
  amount?: number;
  reason?: string;
  /** Null when the system issues it automatically on cancellation. */
  issuedByUserId?: string | null;
}

/**
 * Issues a refund against an order's captured payment.
 *
 * The refund row is created *before* the gateway is called, so a request that
 * dies mid-flight leaves a PENDING record to reconcile rather than money
 * silently returned with nothing to show for it.
 */
export async function issueRefund(input: IssueRefundInput) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw AppError.notFound('We couldn’t find that order.', 'ORDER_NOT_FOUND');

  const summary = await getRefundable(input.orderId);

  if (!summary.paymentId) {
    throw AppError.badRequest(summary.reason ?? 'There is nothing to refund on this order.', 'NOTHING_TO_REFUND');
  }
  if (!summary.isRefundable) {
    throw AppError.conflict(summary.reason ?? 'This order has already been fully refunded.', 'ALREADY_REFUNDED');
  }

  const amount = input.amount ?? summary.refundableAmount;

  if (amount <= 0) {
    throw AppError.badRequest('A refund must be greater than zero.', 'REFUND_AMOUNT_INVALID');
  }
  if (amount > summary.refundableAmount) {
    throw AppError.badRequest(
      `You can refund at most ${formatINR(summary.refundableAmount)} on this order.`,
      'REFUND_EXCEEDS_PAYMENT',
    );
  }

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: summary.paymentId } });

  const pending = await prisma.refund.create({
    data: {
      orderId: order.id,
      paymentId: payment.id,
      amount,
      reason: input.reason?.slice(0, 200) ?? null,
      provider: payment.provider,
      status: 'PENDING',
      issuedByUserId: input.issuedByUserId ?? null,
    },
  });

  const result = await executeAtGateway({
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    amount,
  });

  const refund = await prisma.$transaction(async (tx) => {
    const updated = await tx.refund.update({
      where: { id: pending.id },
      data: {
        status: result.status,
        providerRefundId: result.providerRefundId,
        failureReason: result.failureReason ?? null,
      },
    });

    await syncPaymentStatus(tx, order.id);
    return updated;
  });

  return { refund, summary: await getRefundable(order.id) };
}

/**
 * Called when an order is cancelled. A customer who has already paid should not
 * have to ask for their money back, so the full outstanding amount is returned
 * automatically. Orders that were never paid are left alone.
 */
export async function refundCancelledOrder(orderId: string, reason: string, issuedByUserId?: string | null) {
  const summary = await getRefundable(orderId);
  if (!summary.isRefundable) return null;

  try {
    const { refund } = await issueRefund({ orderId, reason, issuedByUserId: issuedByUserId ?? null });
    return refund;
  } catch (error) {
    // A failed refund must never block the cancellation itself — the order is
    // cancelled either way, and the failure is left on record for staff.
    // eslint-disable-next-line no-console
    console.error(`[refund] automatic refund failed for order ${orderId}`, error);
    return null;
  }
}

export function listRefundsForOrder(orderId: string) {
  return prisma.refund.findMany({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
    include: { issuedBy: { select: { id: true, name: true } } },
  });
}
