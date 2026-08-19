import { AlertTriangle, Banknote, Clock } from 'lucide-react';
import { cn, formatDate, formatINR } from '@/lib/utils';
import type { Order } from '@/types';

/**
 * Tells a customer what happened to their money after a cancellation.
 *
 * "Cancelled" on its own is the moment people worry about the refund, so this
 * states the amount, where it's going and roughly when — and is honest when a
 * refund is still in flight or has failed, rather than implying it's done.
 */
export function RefundNotice({ order, className }: { order: Order; className?: string }) {
  if (order.refunds.length === 0) {
    // Nothing was ever captured — say so, so the customer isn't left wondering.
    if (order.orderStatus === 'CANCELLED' && order.paymentStatus === 'PENDING') {
      return (
        <div className={cn('flex gap-3 rounded-md bg-secondary/70 p-4', className)}>
          <Banknote className="mt-px h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-sans text-sm font-medium text-foreground">Nothing was charged</p>
            <p className="mt-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
              This order was never paid for, so there's nothing to refund.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  const settled = order.refunds.filter((refund) => refund.status === 'SUCCESS');
  const inFlight = order.refunds.filter((refund) => refund.status === 'PENDING' || refund.status === 'PROCESSING');
  const failed = order.refunds.filter((refund) => refund.status === 'FAILED');

  const isPartial = order.paymentStatus === 'PARTIALLY_REFUNDED';

  return (
    <div className={cn('space-y-2.5', className)}>
      {(settled.length > 0 || inFlight.length > 0) && (
        <div className="flex gap-3 rounded-md border border-olive/25 bg-olive/[0.06] p-4">
          {inFlight.length > 0 ? (
            <Clock className="mt-px h-4 w-4 shrink-0 text-olive" aria-hidden />
          ) : (
            <Banknote className="mt-px h-4 w-4 shrink-0 text-olive" aria-hidden />
          )}

          <div className="min-w-0">
            <p className="font-sans text-sm font-medium text-foreground">
              {inFlight.length > 0
                ? `Refund of ${formatINR(order.refundedAmount)} on its way`
                : `${isPartial ? 'Partial refund' : 'Refund'} of ${formatINR(order.refundedAmount)} issued`}
            </p>

            <p className="mt-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
              {order.paymentMethod === 'COD' || order.paymentMethod === 'PAY_AT_COUNTER'
                ? 'Please collect this at the counter.'
                : 'It goes back to the way you paid, and usually lands within 5–7 working days.'}
              {isPartial && ` The remaining ${formatINR(order.total - order.refundedAmount)} covers what was made.`}
            </p>

            <ul className="mt-2.5 space-y-1">
              {[...settled, ...inFlight].map((refund) => (
                <li key={refund.id} className="font-sans text-xs text-muted-foreground">
                  {formatINR(refund.amount)} · {formatDate(refund.createdAt)}
                  {refund.reason ? ` · ${refund.reason}` : ''}
                  {refund.status !== 'SUCCESS' && ' · processing'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* A failed refund is the one thing the customer must be told plainly. */}
      {failed.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-md border border-destructive/25 bg-destructive/[0.04] p-4">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="font-sans text-sm font-medium text-foreground">A refund didn’t go through</p>
            <p className="mt-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
              We couldn’t return {formatINR(failed.reduce((sum, refund) => sum + refund.amount, 0))} automatically.
              Please call the café and we’ll sort it out.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact inline label for order-history cards. */
export function RefundBadgeText({ order }: { order: Order }) {
  if (order.refundedAmount <= 0) return null;

  return (
    <span className="font-sans text-xs text-olive">
      {order.paymentStatus === 'PARTIALLY_REFUNDED' ? 'Partially refunded' : 'Refunded'}{' '}
      {formatINR(order.refundedAmount)}
    </span>
  );
}
