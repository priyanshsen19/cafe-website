import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, FieldHint, Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi } from '@/api/endpoints';
import { cn, formatDate, formatINR } from '@/lib/utils';
import type { Order } from '@/types';

/**
 * Issues a refund against an order. The refundable ceiling comes from the
 * server — the amount already returned is subtracted there — so this dialog
 * can present a limit but never decides it.
 */
export function RefundDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'refundable', order?.id],
    queryFn: () => adminApi.refundable(order!.id).then((response) => response.refundable),
    enabled: Boolean(order) && open,
  });

  useEffect(() => {
    if (open) {
      setMode('FULL');
      setAmount('');
      setReason('');
      setError(null);
    }
  }, [open, order?.id]);

  const refund = useMutation({
    mutationFn: () =>
      adminApi.refund(order!.id, {
        amount: mode === 'PARTIAL' ? Number(amount) : undefined,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'refundable'] });
      toast.success(`${formatINR(result.refund.amount)} refunded`, {
        description:
          result.refundable.refundableAmount > 0
            ? `${formatINR(result.refundable.refundableAmount)} still refundable on this order.`
            : 'This order is now fully refunded.',
      });
      onOpenChange(false);
    },
    onError: (cause: Error) => {
      setError(cause.message);
      toast.error(cause.message);
    },
  });

  if (!order) return null;

  const summary = data;
  const max = summary?.refundableAmount ?? 0;
  const parsed = Number(amount);
  const partialInvalid = mode === 'PARTIAL' && (!amount || Number.isNaN(parsed) || parsed <= 0 || parsed > max);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Refund {order.orderNumber}</DialogTitle>
          <DialogDescription>
            {order.customer.name} · {order.items.length} items · {formatINR(order.total)}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {isLoading && <Skeleton className="h-28 w-full rounded-md" />}

          {summary && !summary.isRefundable && (
            <div className="flex gap-3 rounded-md bg-secondary/70 p-4">
              <Info className="mt-px h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-sans text-sm font-medium text-foreground">Nothing to refund</p>
                <p className="mt-1 font-sans text-[0.8125rem] text-muted-foreground">{summary.reason}</p>
              </div>
            </div>
          )}

          {summary?.isRefundable && (
            <>
              <dl className="space-y-2 font-sans text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd className="tabular-nums text-foreground">{formatINR(summary.paidAmount)}</dd>
                </div>
                {summary.refundedAmount > 0 && (
                  <div className="flex justify-between text-olive">
                    <dt>Already refunded</dt>
                    <dd className="tabular-nums">−{formatINR(summary.refundedAmount)}</dd>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between">
                  <dt className="font-medium text-foreground">Refundable now</dt>
                  <dd className="font-medium tabular-nums text-foreground">{formatINR(summary.refundableAmount)}</dd>
                </div>
              </dl>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'FULL', label: 'Full refund', hint: formatINR(summary.refundableAmount) },
                    { value: 'PARTIAL', label: 'Partial', hint: 'Choose an amount' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    aria-pressed={mode === option.value}
                    className={cn(
                      'rounded-md border p-3 text-left transition-colors',
                      mode === option.value
                        ? 'border-espresso bg-secondary'
                        : 'border-border hover:border-espresso/35',
                    )}
                  >
                    <span className="block font-sans text-sm font-medium text-foreground">{option.label}</span>
                    <span className="mt-0.5 block font-sans text-xs tabular-nums text-muted-foreground">
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>

              {mode === 'PARTIAL' && (
                <div className="mt-4">
                  <Label htmlFor="refund-amount">Amount (₹)</Label>
                  <Input
                    id="refund-amount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={max}
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setError(null);
                    }}
                    invalid={Boolean(amount) && partialInvalid}
                    className="mt-1.5"
                    placeholder={String(max)}
                  />
                  <FieldHint>At most {formatINR(max)} can be returned on this order.</FieldHint>
                </div>
              )}

              <div className="mt-4">
                <Label htmlFor="refund-reason">Reason (optional)</Label>
                <Input
                  id="refund-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Kitchen ran out, customer complaint…"
                  maxLength={200}
                  className="mt-1.5"
                />
                <FieldHint>Shown to the customer alongside the refund.</FieldHint>
              </div>

              <FieldError>{error}</FieldError>
            </>
          )}

          {/* Existing refunds, so staff can see what's already been returned. */}
          {order.refunds.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Refund history
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {order.refunds.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-3 font-sans text-xs">
                    <span className="min-w-0 text-muted-foreground">
                      {formatDate(entry.createdAt)}
                      {entry.issuedBy ? ` · ${entry.issuedBy}` : ' · automatic'}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 tabular-nums',
                        entry.status === 'FAILED' ? 'text-destructive' : 'text-foreground',
                      )}
                    >
                      {formatINR(entry.amount)}
                      {entry.status !== 'SUCCESS' && ` · ${entry.status.toLowerCase()}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              loading={refund.isPending}
              disabled={!summary?.isRefundable || partialInvalid}
              onClick={() => refund.mutate()}
            >
              <Banknote className="h-4 w-4" />
              {mode === 'FULL'
                ? `Refund ${formatINR(max)}`
                : amount && !partialInvalid
                  ? `Refund ${formatINR(parsed)}`
                  : 'Refund'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
