import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, IndianRupee, Receipt, TrendingUp, Users } from 'lucide-react';
import { Skeleton, StatCardSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/States';
import { adminApi } from '@/api/endpoints';
import { useSeo } from '@/hooks/useUtils';
import { cn, formatINR, humanise } from '@/lib/utils';

/**
 * Chart palette drawn from the brand tokens rather than a default library
 * scheme, so the dashboard reads as part of the same product.
 */
const SERIES = {
  revenue: 'hsl(18 59% 45%)',
  orders: 'hsl(79 14% 39%)',
  grid: 'hsl(36 30% 86%)',
  text: 'hsl(24 10% 42%)',
};

const TYPE_COLOURS = ['hsl(18 59% 45%)', 'hsl(79 14% 39%)', 'hsl(18 23% 13%)'];

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function AdminDashboard() {
  useSeo({ title: 'Admin dashboard' });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminApi.dashboard(),
    refetchInterval: 60_000,
  });

  if (isError) {
    return (
      <ErrorState
        title="Unable to load the dashboard"
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  const metrics = data?.metrics;

  const tiles = [
    {
      label: 'Today’s revenue',
      value: metrics ? formatINR(metrics.revenueToday) : '—',
      change: metrics?.revenueChangePercent ?? null,
      icon: IndianRupee,
    },
    { label: 'Orders today', value: metrics ? String(metrics.ordersToday) : '—', change: null, icon: Receipt },
    {
      label: 'Average order',
      value: metrics ? formatINR(metrics.averageOrderValue) : '—',
      change: null,
      icon: TrendingUp,
    },
    { label: 'Customers', value: metrics ? String(metrics.customers) : '—', change: null, icon: Users },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl text-foreground">Today at ALAAP</h1>
      <p className="mt-1.5 font-sans text-sm text-muted-foreground">
        {metrics
          ? `${metrics.activeOrders} live ${metrics.activeOrders === 1 ? 'order' : 'orders'} · ${metrics.lifetimeOrders} all time · ${formatINR(metrics.lifetimeRevenue)} lifetime revenue`
          : 'Loading the day’s numbers…'}
      </p>

      {/* ── headline metrics ── */}
      <div className="mt-7 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
          : tiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <div key={tile.label} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <p className="font-sans text-xs text-muted-foreground">{tile.label}</p>
                    <Icon className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.75} aria-hidden />
                  </div>
                  <p className="mt-2.5 font-display text-3xl tabular-nums text-foreground">{tile.value}</p>
                  {tile.change !== null && (
                    <p
                      className={cn(
                        'mt-1.5 inline-flex items-center gap-1 font-sans text-xs',
                        tile.change >= 0 ? 'text-olive' : 'text-destructive',
                      )}
                    >
                      {tile.change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(tile.change)}% vs yesterday
                    </p>
                  )}
                </div>
              );
            })}
      </div>

      {/* ── revenue over time ── */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 xl:col-span-2">
          <h2 className="font-display text-lg text-foreground">Revenue, last 30 days</h2>
          {isLoading ? (
            <Skeleton className="mt-5 h-64" />
          ) : (
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.series ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SERIES.revenue} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={SERIES.revenue} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={SERIES.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fontSize: 11, fill: SERIES.text }}
                    stroke={SERIES.grid}
                    interval={6}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: SERIES.text }}
                    stroke={SERIES.grid}
                    tickFormatter={(value: number) => `₹${value / 1000}k`}
                  />
                  <ChartTooltip
                    contentStyle={{
                      background: 'hsl(40 50% 98%)',
                      border: '1px solid hsl(36 30% 86%)',
                      borderRadius: '0.5rem',
                      fontSize: '0.8125rem',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    labelFormatter={(label: string) => shortDate(label)}
                    formatter={(value: number) => [formatINR(value), 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={SERIES.revenue}
                    strokeWidth={2}
                    fill="url(#revenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── order type split ── */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-lg text-foreground">Order types</h2>
          {isLoading ? (
            <Skeleton className="mt-5 h-64" />
          ) : (
            <>
              <div className="mt-2 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.orderTypes ?? []}
                      dataKey="count"
                      nameKey="orderType"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {(data?.orderTypes ?? []).map((entry, index) => (
                        <Cell key={entry.orderType} fill={TYPE_COLOURS[index % TYPE_COLOURS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      contentStyle={{
                        background: 'hsl(40 50% 98%)',
                        border: '1px solid hsl(36 30% 86%)',
                        borderRadius: '0.5rem',
                        fontSize: '0.8125rem',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      formatter={(value: number, name: string) => [`${value} orders`, humanise(name)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="mt-3 space-y-2.5">
                {(data?.orderTypes ?? []).map((entry, index) => (
                  <li key={entry.orderType} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: TYPE_COLOURS[index % TYPE_COLOURS.length] }}
                      />
                      <span className="truncate font-sans text-[0.8125rem] text-foreground">
                        {humanise(entry.orderType)}
                      </span>
                    </span>
                    <span className="font-sans text-[0.8125rem] tabular-nums text-muted-foreground">
                      {entry.count} · {formatINR(entry.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ── orders per day + popular dishes ── */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-lg text-foreground">Orders per day</h2>
          {isLoading ? (
            <Skeleton className="mt-5 h-56" />
          ) : (
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.series ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke={SERIES.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fontSize: 11, fill: SERIES.text }}
                    stroke={SERIES.grid}
                    interval={6}
                  />
                  <YAxis tick={{ fontSize: 11, fill: SERIES.text }} stroke={SERIES.grid} allowDecimals={false} />
                  <ChartTooltip
                    contentStyle={{
                      background: 'hsl(40 50% 98%)',
                      border: '1px solid hsl(36 30% 86%)',
                      borderRadius: '0.5rem',
                      fontSize: '0.8125rem',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    labelFormatter={(label: string) => shortDate(label)}
                    formatter={(value: number) => [`${value}`, 'Orders']}
                  />
                  <Bar dataKey="orders" fill={SERIES.orders} radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-lg text-foreground">Most ordered</h2>
          {isLoading ? (
            <Skeleton className="mt-5 h-56" />
          ) : (
            <ol className="mt-5 space-y-3">
              {(data?.popularDishes ?? []).map((dish, index) => {
                const max = data?.popularDishes[0]?.quantity ?? 1;
                return (
                  <li key={dish.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate font-sans text-[0.8125rem] text-foreground">
                        <span className="mr-2 tabular-nums text-muted-foreground">{index + 1}</span>
                        {dish.name}
                      </span>
                      <span className="shrink-0 font-sans text-xs tabular-nums text-muted-foreground">
                        {dish.quantity} · {formatINR(dish.revenue)}
                      </span>
                    </div>
                    {/* A simple bar keeps the ranking readable without a second chart. */}
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-terracotta/70"
                        style={{ width: `${Math.round((dish.quantity / max) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
