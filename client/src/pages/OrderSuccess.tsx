import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Bike, Clock, MapPin, QrCode, Receipt, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/States';
import { orderApi } from '@/api/endpoints';
import { useSeo } from '@/hooks/useUtils';
import { formatDateTime, formatINR, formatTime, humanise } from '@/lib/utils';
import type { Order } from '@/types';

/** Hand-drawn-feeling tick that draws itself once, rather than a bouncing badge. */
function SuccessMark({ isPaid }: { isPaid: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      initial={reduceMotion ? undefined : { scale: 0.85, opacity: 0 }}
      animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`grid h-16 w-16 place-items-center rounded-full ${isPaid ? 'bg-olive/[0.12]' : 'bg-terracotta/[0.12]'}`}
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <path
          d="M7 17l6 6L25 10"
          fill="none"
          stroke={isPaid ? 'hsl(79 14% 39%)' : 'hsl(18 59% 45%)'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="48"
          className={reduceMotion ? undefined : 'animate-draw-check'}
        />
      </svg>
    </motion.span>
  );
}

function FulfilmentDetail({ order }: { order: Order }) {
  if (order.orderType === 'DELIVERY' && order.deliveryAddress) {
    return (
      <div className="flex gap-3.5">
        <Bike className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-sans text-[0.8125rem] font-medium text-foreground">Delivering to</p>
          <p className="mt-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
            {order.deliveryAddress.fullName} · {order.deliveryAddress.phone}
            <br />
            {order.deliveryAddress.line1}
            {order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ''}
            <br />
            {order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.postalCode}
          </p>
          {order.deliveryAddress.instructions && (
            <p className="mt-1.5 font-sans text-xs italic text-muted-foreground">
              “{order.deliveryAddress.instructions}”
            </p>
          )}
        </div>
      </div>
    );
  }

  if (order.orderType === 'PICKUP' && order.cafe) {
    return (
      <div className="flex gap-3.5">
        <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-sans text-[0.8125rem] font-medium text-foreground">Collect from</p>
          <p className="mt-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
            ALAAP {order.cafe.name}
            <br />
            {order.cafe.line1}, {order.cafe.city}
            <br />
            {order.cafe.phone}
          </p>
        </div>
      </div>
    );
  }

  if (order.orderType === 'DINE_IN' && order.table) {
    return (
      <div className="flex gap-3.5">
        <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-sans text-[0.8125rem] font-medium text-foreground">Serving to</p>
          <p className="mt-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
            Table {order.table.label} · {order.table.floor}
            <br />
            {order.cafe?.name}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default function OrderSuccess() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.detail(id!).then((response) => response.order),
    enabled: Boolean(id),
  });

  useSeo({
    title: data ? `Order ${data.orderNumber}` : 'Order confirmed',
    description: 'Your ALAAP order is confirmed.',
  });

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="flex flex-col items-center gap-5">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="mt-10 h-80 rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container py-20">
        <ErrorState
          title="We couldn’t find that order"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const order = data;
  const isPaid = order.paymentStatus === 'SUCCESS';
  const isPayLater = order.paymentMethod === 'COD' || order.paymentMethod === 'PAY_AT_COUNTER';
  const paymentFailed = order.paymentStatus === 'FAILED';
  // An online order that was never paid for is not a placed order, and this
  // page must not tell the customer otherwise.
  const awaitingPayment = order.orderStatus === 'AWAITING_PAYMENT';

  return (
    <div className="container max-w-2xl py-14 lg:py-20">
      {/* ── confirmation ── */}
      <div className="flex flex-col items-center text-center">
        <SuccessMark isPaid={(isPaid || isPayLater) && !awaitingPayment} />

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 text-display-sm text-foreground text-balance"
        >
          {awaitingPayment
            ? 'Almost there — your payment isn’t complete.'
            : paymentFailed
              ? 'Your order is saved.'
              : 'Your order is confirmed.'}
        </motion.h1>

        <p className="mt-3 font-display text-xl text-muted-foreground tabular-nums">Order {order.orderNumber}</p>

        {awaitingPayment || paymentFailed ? (
          <div className="mt-6 flex gap-3 rounded-md border border-terracotta/30 bg-terracotta/[0.06] p-4 text-left">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-terracotta" aria-hidden />
            <div>
              <p className="font-sans text-sm font-medium text-foreground">
                {awaitingPayment ? 'This order hasn’t been placed yet' : 'Payment could not be completed'}
              </p>
              <p className="mt-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
                Nothing has been charged. We’ve held your items, but the kitchen won’t start until payment
                goes through.
              </p>
              <Button asChild size="sm" className="mt-3.5">
                <Link to="/account/orders">Complete payment</Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-4 font-sans text-[0.9375rem] text-muted-foreground">
            {order.scheduledFor ? (
              <>Scheduled for {formatTime(order.scheduledFor)}</>
            ) : (
              <>
                Estimated {order.orderType === 'DELIVERY' ? 'delivery' : 'preparation'}:{' '}
                <span className="text-foreground">{order.orderType === 'DELIVERY' ? '25–35' : '15–20'} minutes</span>
              </>
            )}
          </p>
        )}
      </div>

      {/* ── receipt ── */}
      <div className="mt-10 rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="font-sans text-sm font-medium text-foreground">Receipt</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" size="sm">
              {humanise(order.orderType)}
            </Badge>
            <Badge variant={isPaid ? 'olive' : paymentFailed ? 'subtle' : 'muted'} size="sm">
              {isPaid ? 'Paid' : isPayLater ? 'Pay on handover' : humanise(order.paymentStatus)}
            </Badge>
          </div>
        </div>

        <div className="px-6 py-5">
          <ul className="space-y-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3.5">
                <div className="media h-14 w-14 shrink-0 rounded-md">
                  <img src={item.image} alt="" width={112} height={112} loading="lazy" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[0.9375rem] font-medium leading-snug text-foreground">
                    {item.quantity} × {item.name}
                  </p>
                  {item.modifierSummary && (
                    <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
                      {item.modifierSummary}
                    </p>
                  )}
                  {item.notes && <p className="mt-1 font-sans text-xs italic text-muted-foreground">“{item.notes}”</p>}
                </div>
                <span className="font-sans text-sm tabular-nums text-foreground">{formatINR(item.subtotal)}</span>
              </li>
            ))}
          </ul>

          <Separator className="my-5" />

          <dl className="space-y-2.5 font-sans text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums text-foreground">{formatINR(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-olive">
                <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
                <dd className="tabular-nums">−{formatINR(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST</dt>
              <dd className="tabular-nums text-foreground">{formatINR(order.tax)}</dd>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums text-foreground">{formatINR(order.deliveryFee)}</dd>
              </div>
            )}
            {order.paymentFee > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payment processing</dt>
                <dd className="tabular-nums text-foreground">{formatINR(order.paymentFee)}</dd>
              </div>
            )}
          </dl>

          <Separator className="my-5" />

          <div className="flex items-baseline justify-between">
            <span className="font-display text-lg text-foreground">Total</span>
            <span className="font-display text-2xl tabular-nums text-foreground">{formatINR(order.total)}</span>
          </div>

          <Separator className="my-5" />

          <div className="space-y-4">
            <FulfilmentDetail order={order} />

            <div className="flex gap-3.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-sans text-[0.8125rem] font-medium text-foreground">Placed</p>
                <p className="mt-1 font-sans text-[0.8125rem] text-muted-foreground">
                  {formatDateTime(order.createdAt)}
                </p>
              </div>
            </div>

            {order.notes && (
              <div className="flex gap-3.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-sans text-[0.8125rem] font-medium text-foreground">Your note</p>
                  <p className="mt-1 font-sans text-[0.8125rem] italic text-muted-foreground">“{order.notes}”</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── actions ── */}
      <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
        <Button asChild size="lg">
          <Link to={`/orders/${order.id}/tracking`}>
            Track order
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/account/orders">View my orders</Link>
        </Button>
        <Button asChild variant="ghost" className="sm:col-span-2">
          <Link to="/menu">Continue exploring</Link>
        </Button>
      </div>
    </div>
  );
}
