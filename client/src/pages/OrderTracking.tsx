import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Bike,
  Check,
  ChefHat,
  CircleDot,
  Clock,
  CreditCard,
  Package,
  QrCode,
  Radio,
  Receipt,
  Store,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/States';
import { RefundNotice } from '@/components/orders/RefundNotice';
import { orderApi } from '@/api/endpoints';
import { useOrderSocket, useSocketConnection } from '@/hooks/useSocket';
import { useSeo } from '@/hooks/useUtils';
import { cn, formatINR, formatTime, humanise } from '@/lib/utils';
import type { OrderStatus } from '@/types';

const STEP_ICONS: Record<OrderStatus, typeof Check> = {
  AWAITING_PAYMENT: CreditCard,
  PLACED: Receipt,
  CONFIRMED: Check,
  PREPARING: ChefHat,
  READY: Package,
  OUT_FOR_DELIVERY: Bike,
  DELIVERED: Check,
  COLLECTED: Store,
  SERVED: QrCode,
  CANCELLED: X,
};

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tracking', id],
    queryFn: () => orderApi.tracking(id!),
    enabled: Boolean(id),
    // Polling fallback for when the socket can't connect (proxies, blocked WS).
    refetchInterval: (query) => (query.state.data?.order.isActive ? 20_000 : false),
  });

  const { isConnected } = useSocketConnection();

  // Live push: the kitchen moving this order re-fetches the timeline instantly.
  useOrderSocket(data?.order.id, () => {
    void queryClient.invalidateQueries({ queryKey: ['tracking', id] });
    void queryClient.invalidateQueries({ queryKey: ['order', id] });
  });

  useSeo({
    title: data ? `Tracking ${data.order.orderNumber}` : 'Track your order',
    description: 'Live status for your ALAAP order.',
  });

  const cancelOrder = useMutation({
    mutationFn: () => orderApi.cancel(id!),
    onSuccess: () => {
      toast.success('Your order has been cancelled.');
      void queryClient.invalidateQueries({ queryKey: ['tracking', id] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setCancelling(false);
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message);
      setCancelling(false);
    },
  });

  if (isLoading) {
    return (
      <div className="container max-w-3xl py-14">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-10 w-64" />
        <Skeleton className="mt-10 h-96 rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container py-20">
        <ErrorState
          title="We couldn’t load that order"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const { order, steps, isCancelled, cancelledReason } = data;
  const canCancel = ['PLACED', 'CONFIRMED', 'PREPARING'].includes(order.orderStatus);

  return (
    <div className="container max-w-3xl py-12 lg:py-16">
      {/* ── header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Order tracking</p>
          <h1 className="mt-3 text-display-sm text-foreground tabular-nums">{order.orderNumber}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" size="lg">
              {humanise(order.orderType)}
            </Badge>
            <Badge variant={isCancelled ? 'subtle' : order.isActive ? 'accent' : 'olive'} size="lg">
              {order.statusLabel}
            </Badge>
            {order.table && (
              <Badge variant="muted" size="lg">
                Table {order.table.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Live-connection indicator: honest about whether push is working. */}
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <Radio
            className={cn('h-3 w-3', isConnected && order.isActive ? 'animate-pulse text-olive' : 'text-muted-foreground')}
            aria-hidden
          />
          <span className="font-sans text-[0.6875rem] text-muted-foreground">
            {order.isActive ? (isConnected ? 'Live updates on' : 'Checking every 20s') : 'Order complete'}
          </span>
        </div>
      </div>

      {/* ── timeline ── */}
      <div className="mt-10 rounded-lg border border-border bg-card p-6 lg:p-8">
        {isCancelled ? (
          <div className="flex gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
              <X className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl text-foreground">This order was cancelled</p>
              <p className="mt-1.5 font-sans text-sm text-muted-foreground">
                {cancelledReason ?? 'No further action is needed.'}
              </p>

              {/* The first question after a cancellation is always "where's my money". */}
              <RefundNotice order={order} className="mt-5" />

              <Button asChild variant="outline" size="sm" className="mt-5">
                <Link to="/menu">Order something else</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ol className="relative">
            {steps.map((step, index) => {
              const Icon = STEP_ICONS[step.status];
              const isLast = index === steps.length - 1;

              return (
                <li key={step.status} className="relative flex gap-4 pb-8 last:pb-0">
                  {/* connector */}
                  {!isLast && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-[1.1875rem] top-10 h-[calc(100%-1.75rem)] w-px',
                        step.isComplete ? 'bg-olive/45' : 'bg-border',
                      )}
                    />
                  )}

                  <span
                    className={cn(
                      'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-colors',
                      step.isCurrent
                        ? 'border-terracotta bg-terracotta text-cream'
                        : step.isComplete
                          ? 'border-olive/45 bg-olive/[0.12] text-olive'
                          : 'border-border bg-card text-muted-foreground/50',
                    )}
                  >
                    {step.isCurrent ? (
                      <motion.span
                        animate={{ scale: [1, 1.12, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="grid place-items-center"
                      >
                        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                      </motion.span>
                    ) : step.isComplete ? (
                      <Check className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                    ) : (
                      <CircleDot className="h-4 w-4" aria-hidden />
                    )}
                  </span>

                  <div className="min-w-0 flex-1 pt-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p
                        className={cn(
                          'font-display text-lg leading-none',
                          step.isComplete || step.isCurrent ? 'text-foreground' : 'text-muted-foreground/70',
                        )}
                      >
                        {step.label}
                      </p>
                      {step.at && (
                        <time
                          dateTime={step.at}
                          className="font-sans text-xs tabular-nums text-muted-foreground"
                        >
                          {formatTime(step.at)}
                        </time>
                      )}
                    </div>
                    <p
                      className={cn(
                        'mt-1.5 font-sans text-[0.8125rem] leading-relaxed',
                        step.isCurrent ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {!isCancelled && order.isActive && order.estimatedReadyAt && (
          <div className="mt-6 flex items-center gap-2.5 rounded-md bg-secondary/70 px-4 py-3">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="font-sans text-[0.8125rem] text-foreground">
              {order.scheduledFor ? 'Scheduled for ' : 'Expected around '}
              <span className="font-medium tabular-nums">
                {formatTime(order.scheduledFor ?? order.estimatedReadyAt)}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* ── order detail ── */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="font-display text-lg text-foreground">Your order</h2>

        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span className="font-sans text-xs tabular-nums text-muted-foreground">{item.quantity}×</span>
              <span className="min-w-0 flex-1">
                <span className="block font-sans text-[0.875rem] font-medium text-foreground">{item.name}</span>
                {item.modifierSummary && (
                  <span className="mt-0.5 block font-sans text-xs text-muted-foreground">{item.modifierSummary}</span>
                )}
              </span>
              <span className="font-sans text-[0.875rem] tabular-nums text-foreground">{formatINR(item.subtotal)}</span>
            </li>
          ))}
        </ul>

        <Separator className="my-4" />

        <div className="flex items-center justify-between">
          <span className="font-sans text-sm text-muted-foreground">
            Total ·{' '}
            {order.paymentStatus === 'SUCCESS'
              ? 'Paid'
              : order.paymentMethod === 'COD'
                ? 'Cash on delivery'
                : order.paymentMethod === 'PAY_AT_COUNTER'
                  ? 'Pay at counter'
                  : humanise(order.paymentStatus)}
          </span>
          <span className="font-display text-xl tabular-nums text-foreground">{formatINR(order.total)}</span>
        </div>

        {order.orderType === 'DELIVERY' && order.deliveryAddress && (
          <p className="mt-4 font-sans text-xs leading-relaxed text-muted-foreground">
            Delivering to {order.deliveryAddress.line1}, {order.deliveryAddress.city}{' '}
            {order.deliveryAddress.postalCode}
          </p>
        )}
        {order.orderType === 'PICKUP' && order.cafe && (
          <p className="mt-4 font-sans text-xs leading-relaxed text-muted-foreground">
            Collecting from ALAAP {order.cafe.name}, {order.cafe.line1}
          </p>
        )}
      </div>

      {/* ── actions ── */}
      <div className="mt-8 flex flex-wrap gap-2.5">
        <Button asChild variant="outline">
          <Link to="/account/orders">All my orders</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/menu">Order something else</Link>
        </Button>

        {canCancel && (
          <div className="ml-auto">
            {cancelling ? (
              <div className="flex items-center gap-2">
                <span className="font-sans text-xs text-muted-foreground">Cancel this order?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  loading={cancelOrder.isPending}
                  onClick={() => cancelOrder.mutate()}
                >
                  Yes, cancel
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCancelling(false)}>
                  Keep it
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
                Cancel order
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
