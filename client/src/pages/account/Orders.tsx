import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, RotateCcw, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Separator } from '@/components/ui/form-controls';
import { OrderCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { ReviewDialog } from '@/components/orders/ReviewDialog';
import { RefundBadgeText } from '@/components/orders/RefundNotice';
import { orderApi } from '@/api/endpoints';
import { cartKeys } from '@/hooks/useCart';
import { useUiStore } from '@/store/ui';
import { useSeo } from '@/hooks/useUtils';
import { formatDate, formatINR, humanise, pluralise } from '@/lib/utils';

type Filter = 'all' | 'active' | 'completed' | 'cancelled';

const TABS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AccountOrders() {
  useSeo({ title: 'My orders', canonicalPath: '/account/orders' });

  const [filter, setFilter] = useState<Filter>('all');
  const [reviewProduct, setReviewProduct] = useState<{ id: string; name: string; image: string } | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const openCart = useUiStore((state) => state.openCart);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['orders', filter],
    queryFn: () => orderApi.list(filter).then((response) => response.orders),
  });

  /**
   * Reorder rebuilds the cart from live availability and current prices, then
   * reports anything that changed rather than silently substituting.
   */
  const reorder = useMutation({
    mutationFn: (orderId: string) => orderApi.reorder(orderId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: cartKeys.all });

      if (result.added.length === 0) {
        toast.error('None of those items are available right now.');
        return;
      }

      toast.success(`${pluralise(result.added.length, 'item')} added to your order`);

      if (result.unavailable.length > 0) {
        toast.warning(`${result.unavailable.join(', ')} ${result.unavailable.length === 1 ? 'is' : 'are'} unavailable`, {
          description: 'We left those out of your cart.',
        });
      }
      if (result.repriced.length > 0) {
        toast.info('Some prices have changed since your last order', {
          description: result.repriced
            .map((item) => `${item.name}: ${formatINR(item.was)} → ${formatINR(item.now)}`)
            .join(' · '),
        });
      }

      openCart();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const orders = data ?? [];

  return (
    <div>
      <h2 className="font-display text-2xl text-foreground">My orders</h2>
      <p className="mt-2 font-sans text-sm text-muted-foreground">
        Every order, with tracking and one-tap reordering.
      </p>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="mt-7">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isError && (
        <ErrorState
          title="Unable to load your orders"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="mt-6 space-y-4">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <EmptyState
          icon={Package}
          title="Your next favourite meal is waiting."
          description={
            filter === 'all'
              ? 'You haven’t placed an order yet.'
              : `No ${filter} orders to show right now.`
          }
          action={{ label: 'Explore the menu', to: '/menu' }}
          className="mt-6 rounded-lg border border-border bg-card"
        />
      )}

      {orders.length > 0 && (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg border border-border bg-card p-5">
              {/* ── head ── */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg tabular-nums text-foreground">{order.orderNumber}</span>
                    <Badge variant={order.orderStatus === 'CANCELLED' ? 'subtle' : order.isActive ? 'accent' : 'olive'} size="sm">
                      {order.statusLabel}
                    </Badge>
                    <Badge variant="outline" size="sm">
                      {humanise(order.orderType)}
                    </Badge>
                  </div>
                  <p className="mt-1.5 font-sans text-xs text-muted-foreground">
                    {formatDate(order.createdAt)} · {pluralise(order.itemCount, 'item')} ·{' '}
                    {order.paymentStatus === 'SUCCESS' ? 'Paid' : humanise(order.paymentStatus)}
                    {order.table && ` · Table ${order.table.label}`}
                  </p>
                  <RefundBadgeText order={order} />
                </div>
                <span className="font-display text-xl tabular-nums text-foreground">{formatINR(order.total)}</span>
              </div>

              <Separator className="my-4" />

              {/* ── items ── */}
              <ul className="space-y-2.5">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <div className="media h-11 w-11 shrink-0 rounded-md">
                      <img src={item.image} alt="" width={88} height={88} loading="lazy" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-[0.8125rem] font-medium text-foreground">
                        {item.quantity} × {item.name}
                      </p>
                      {item.modifierSummary && (
                        <p className="truncate font-sans text-xs text-muted-foreground">{item.modifierSummary}</p>
                      )}
                    </div>
                    {/* Reviewing is only offered once the order is complete. */}
                    {!order.isActive && order.orderStatus !== 'CANCELLED' && item.productId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setReviewProduct({ id: item.productId!, name: item.name, image: item.image })
                        }
                      >
                        <Star className="h-3.5 w-3.5" />
                        Review
                      </Button>
                    )}
                  </li>
                ))}
              </ul>

              {/* ── actions ── */}
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/orders/${order.id}/tracking`}>
                    {order.isActive ? 'Track order' : 'View order'}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={reorder.isPending && reorder.variables === order.id}
                  onClick={() => reorder.mutate(order.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Order again
                </Button>
                {order.paymentStatus === 'FAILED' && (
                  <Button size="sm" variant="accent" onClick={() => navigate(`/orders/${order.id}/success`)}>
                    Retry payment
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReviewDialog
        product={reviewProduct}
        open={Boolean(reviewProduct)}
        onOpenChange={(open) => !open && setReviewProduct(null)}
      />
    </div>
  );
}
