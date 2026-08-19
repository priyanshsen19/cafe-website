import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { RefundDialog } from '@/components/admin/RefundDialog';
import { adminApi } from '@/api/endpoints';
import { useDebounced, useSeo } from '@/hooks/useUtils';
import { cn, formatDateTime, formatINR, humanise } from '@/lib/utils';
import type { Order, OrderStatus, OrderType } from '@/types';

const STATUSES: OrderStatus[] = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COLLECTED',
  'SERVED',
  'CANCELLED',
];

/** Which statuses an order can legally move to, mirroring the server's guard. */
function nextStatuses(order: Order): OrderStatus[] {
  const flow: Record<OrderType, OrderStatus[]> = {
    DELIVERY: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'],
    PICKUP: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'COLLECTED'],
    DINE_IN: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'],
  };

  if (order.orderStatus === 'CANCELLED') return [];

  const path = flow[order.orderType];
  const index = path.indexOf(order.orderStatus);
  const forward = index === -1 ? [] : path.slice(index + 1);
  const cancellable = ['PLACED', 'CONFIRMED', 'PREPARING'].includes(order.orderStatus);

  return cancellable ? [...forward, 'CANCELLED'] : forward;
}

export default function AdminOrders() {
  useSeo({ title: 'Orders — Admin' });

  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [orderType, setOrderType] = useState<OrderType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<Order | null>(null);

  const debouncedSearch = useDebounced(search.trim(), 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'orders', status, orderType, debouncedSearch, page],
    queryFn: () =>
      adminApi.orders({
        status: status === 'ALL' ? undefined : status,
        orderType: orderType === 'ALL' ? undefined : orderType,
        q: debouncedSearch || undefined,
        page,
        pageSize: 20,
      }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: OrderStatus }) => adminApi.updateOrderStatus(id, next),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['kitchen-board'] });
      toast.success(`Order moved to ${humanise(variables.next).toLowerCase()}`);
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const orders = data?.orders ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl text-foreground">Orders</h1>
      <p className="mt-1.5 font-sans text-sm text-muted-foreground">
        {data ? `${data.pagination.total} orders` : 'Loading…'} · search by number, name, phone or email
      </p>

      {/* ── filters ── */}
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[15rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="CA-1048, name, phone…"
            aria-label="Search orders"
            className="h-10 pl-9"
          />
        </div>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as OrderStatus | 'ALL');
            setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-auto min-w-[10rem]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {humanise(entry)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={orderType}
          onValueChange={(value) => {
            setOrderType(value as OrderType | 'ALL');
            setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-auto min-w-[9rem]" aria-label="Filter by order type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="DELIVERY">Delivery</SelectItem>
            <SelectItem value="PICKUP">Pickup</SelectItem>
            <SelectItem value="DINE_IN">Dine-in</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <ErrorState
          title="Unable to load orders"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="mt-6 space-y-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <EmptyState
          title="No orders match those filters"
          description="Try clearing the search or choosing a different status."
          className="mt-6 rounded-lg border border-border bg-card"
        />
      )}

      {/* ── list ── */}
      {orders.length > 0 && (
        <ul className="mt-6 space-y-2.5">
          {orders.map((order) => {
            const isOpen = expanded === order.id;
            const transitions = nextStatuses(order);

            return (
              <li key={order.id} className="overflow-hidden rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
                >
                  <span className="font-display text-lg tabular-nums text-foreground">{order.orderNumber}</span>

                  <Badge variant={order.orderStatus === 'CANCELLED' ? 'subtle' : order.isActive ? 'accent' : 'olive'} size="sm">
                    {order.statusLabel}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    {humanise(order.orderType)}
                    {order.table && ` · ${order.table.label}`}
                  </Badge>
                  <Badge variant={order.paymentStatus === 'SUCCESS' ? 'olive' : 'muted'} size="sm">
                    {order.paymentStatus === 'SUCCESS' ? 'Paid' : humanise(order.paymentStatus)}
                  </Badge>

                  <span className="min-w-0 flex-1 truncate font-sans text-[0.8125rem] text-muted-foreground">
                    {order.contactName} · {order.contactPhone}
                  </span>

                  <span className="font-sans text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </span>
                  <span className="font-display text-lg tabular-nums text-foreground">{formatINR(order.total)}</span>

                  <ChevronDown
                    className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-secondary/30 px-5 py-5">
                    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                      {/* items */}
                      <div>
                        <p className="mb-3 font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Items
                        </p>
                        <ul className="space-y-2.5">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex gap-3">
                              <span className="font-sans text-xs tabular-nums text-muted-foreground">
                                {item.quantity}×
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-sans text-[0.8125rem] font-medium text-foreground">
                                  {item.name}
                                </span>
                                {item.modifierSummary && (
                                  <span className="block font-sans text-xs text-muted-foreground">
                                    {item.modifierSummary}
                                  </span>
                                )}
                                {item.notes && (
                                  <span className="block font-sans text-xs italic text-muted-foreground">
                                    “{item.notes}”
                                  </span>
                                )}
                              </span>
                              <span className="font-sans text-[0.8125rem] tabular-nums text-foreground">
                                {formatINR(item.subtotal)}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <Separator className="my-4" />

                        <dl className="space-y-1.5 font-sans text-[0.8125rem]">
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Subtotal</dt>
                            <dd className="tabular-nums text-foreground">{formatINR(order.subtotal)}</dd>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between text-olive">
                              <dt>Discount {order.couponCode ? `(${order.couponCode})` : ''}</dt>
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
                        </dl>
                      </div>

                      {/* fulfilment + actions */}
                      <div>
                        <p className="mb-3 font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Fulfilment
                        </p>
                        <dl className="space-y-2 font-sans text-[0.8125rem]">
                          <div>
                            <dt className="text-muted-foreground">Customer</dt>
                            <dd className="text-foreground">
                              {order.customer.name} · {order.customer.email}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Payment</dt>
                            <dd className="text-foreground">
                              {humanise(order.paymentMethod)} · {humanise(order.paymentStatus)}
                            </dd>
                          </div>
                          {order.cafe && (
                            <div>
                              <dt className="text-muted-foreground">Café</dt>
                              <dd className="text-foreground">
                                {order.cafe.name}, {order.cafe.city}
                              </dd>
                            </div>
                          )}
                          {order.deliveryAddress && (
                            <div>
                              <dt className="text-muted-foreground">Delivering to</dt>
                              <dd className="text-foreground">
                                {order.deliveryAddress.line1}
                                {order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ''},{' '}
                                {order.deliveryAddress.city} {order.deliveryAddress.postalCode}
                              </dd>
                            </div>
                          )}
                          {order.table && (
                            <div>
                              <dt className="text-muted-foreground">Table</dt>
                              <dd className="text-foreground">
                                {order.table.label} · {order.table.floor}
                              </dd>
                            </div>
                          )}
                          {order.scheduledFor && (
                            <div>
                              <dt className="text-muted-foreground">Scheduled</dt>
                              <dd className="text-foreground">{formatDateTime(order.scheduledFor)}</dd>
                            </div>
                          )}
                          {order.notes && (
                            <div>
                              <dt className="text-muted-foreground">Note</dt>
                              <dd className="italic text-foreground">“{order.notes}”</dd>
                            </div>
                          )}
                        </dl>

                        {/* Refunds sit beside the status controls — cancelling
                            and refunding are the two money-affecting actions. */}
                        {order.refundedAmount > 0 && (
                          <p className="mt-3 font-sans text-[0.8125rem] text-olive">
                            {formatINR(order.refundedAmount)} refunded
                            {order.paymentStatus === 'PARTIALLY_REFUNDED' ? ' (partial)' : ''}
                          </p>
                        )}

                        {order.paymentStatus !== 'PENDING' && order.paymentStatus !== 'REFUNDED' && (
                          <Button size="sm" variant="outline" className="mt-4" onClick={() => setRefunding(order)}>
                            <Banknote className="h-3.5 w-3.5" />
                            {order.refundedAmount > 0 ? 'Refund more' : 'Issue refund'}
                          </Button>
                        )}

                        {transitions.length > 0 && (
                          <div className="mt-5">
                            <p className="mb-2.5 font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Move to
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {transitions.map((next) => (
                                <Button
                                  key={next}
                                  size="sm"
                                  variant={next === 'CANCELLED' ? 'outline' : 'default'}
                                  loading={updateStatus.isPending && updateStatus.variables?.id === order.id && updateStatus.variables?.next === next}
                                  onClick={() => updateStatus.mutate({ id: order.id, next })}
                                >
                                  {humanise(next)}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <RefundDialog
        order={refunding}
        open={Boolean(refunding)}
        onOpenChange={(next) => !next && setRefunding(null)}
      />

      {/* ── pagination ── */}
      {data && data.pagination.totalPages > 1 && (
        <div className="mt-7 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </Button>
          <span className="font-sans text-xs text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
