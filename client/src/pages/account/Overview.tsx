import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Heart, MapPin, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/States';
import { accountApi, orderApi } from '@/api/endpoints';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/hooks/useUtils';
import { formatDate, formatINR, pluralise } from '@/lib/utils';

export default function AccountOverview() {
  useSeo({ title: 'My account', canonicalPath: '/account' });

  const { user, stats } = useAuth();

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'all'],
    queryFn: () => orderApi.list('all').then((response) => response.orders),
  });

  const { data: wishlist } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => accountApi.wishlist().then((response) => response.items),
  });

  const active = (orders ?? []).filter((order) => order.isActive);
  const recent = (orders ?? []).slice(0, 3);

  const tiles = [
    {
      label: 'Orders',
      value: String(stats?.orderCount ?? orders?.length ?? 0),
      hint: 'All time',
      to: '/account/orders',
      icon: Package,
    },
    {
      label: 'Spent',
      value: formatINR(stats?.totalSpent ?? 0),
      hint: 'All time',
      to: '/account/orders',
      icon: Package,
    },
    {
      label: 'Saved addresses',
      value: String(stats?.addressCount ?? 0),
      hint: 'Delivery destinations',
      to: '/account/addresses',
      icon: MapPin,
    },
    {
      label: 'Favourites',
      value: String(wishlist?.length ?? 0),
      hint: 'Dishes you saved',
      to: '/account/wishlist',
      icon: Heart,
    },
  ];

  return (
    <div>
      <h2 className="font-display text-2xl text-foreground">
        Welcome back, {user?.name.split(' ')[0]}
      </h2>
      <p className="mt-2 font-sans text-sm text-muted-foreground">
        Here’s where your orders, addresses and favourites live.
      </p>

      {/* ── stats ── */}
      <dl className="mt-8 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            to={tile.to}
            className="group rounded-lg border border-border bg-card p-5 transition-all hover:border-espresso/25 hover:shadow-subtle"
          >
            <dt className="font-sans text-xs text-muted-foreground">{tile.label}</dt>
            <dd className="mt-2 font-display text-2xl tabular-nums text-foreground">{tile.value}</dd>
            <p className="mt-1 font-sans text-[0.6875rem] text-muted-foreground">{tile.hint}</p>
          </Link>
        ))}
      </dl>

      {/* ── live orders ── */}
      {active.length > 0 && (
        <section className="mt-10">
          <h3 className="font-display text-xl text-foreground">In progress</h3>
          <ul className="mt-4 space-y-3">
            {active.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/orders/${order.id}/tracking`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-terracotta/30 bg-terracotta/[0.04] p-5 transition-colors hover:border-terracotta/50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg tabular-nums text-foreground">{order.orderNumber}</span>
                      <Badge variant="accent" size="sm">
                        {order.statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-1.5 truncate font-sans text-[0.8125rem] text-muted-foreground">
                      {order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-foreground">
                    Track
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── recent orders ── */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-foreground">Recent orders</h3>
          <Button asChild variant="ghost" size="sm">
            <Link to="/account/orders">
              See all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {ordersLoading && (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        )}

        {!ordersLoading && recent.length === 0 && (
          <EmptyState
            icon={Package}
            title="Your next favourite meal is waiting."
            description="You haven’t ordered yet. Have a look at what the kitchen is making today."
            action={{ label: 'Explore the menu', to: '/menu' }}
            className="mt-4 rounded-lg border border-border bg-card"
          />
        )}

        {recent.length > 0 && (
          <ul className="mt-4 space-y-3">
            {recent.map((order) => (
              <li key={order.id}>
                <Link
                  to={`/orders/${order.id}/tracking`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-espresso/25"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="media h-12 w-12 shrink-0 rounded-md">
                      {order.items[0] && <img src={order.items[0].image} alt="" width={96} height={96} loading="lazy" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans text-sm font-medium tabular-nums text-foreground">
                          {order.orderNumber}
                        </span>
                        <Badge variant={order.isActive ? 'accent' : 'muted'} size="sm">
                          {order.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 font-sans text-xs text-muted-foreground">
                        {formatDate(order.createdAt)} · {pluralise(order.itemCount, 'item')}
                      </p>
                    </div>
                  </div>
                  <span className="font-display text-lg tabular-nums text-foreground">{formatINR(order.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
