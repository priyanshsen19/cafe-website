import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Bike, Clock, QrCode, Radio, Store, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/States';
import { Logo } from '@/components/common/Logo';
import { adminApi } from '@/api/endpoints';
import { useKitchenSocket } from '@/hooks/useSocket';
import { useSeo, useTicker } from '@/hooks/useUtils';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatINR } from '@/lib/utils';
import type { KitchenCard, OrderStatus, OrderType } from '@/types';

/** The next state a card moves to, and the label the button should carry. */
const ADVANCE: Record<string, { next: OrderStatus; label: string } | undefined> = {
  PLACED: { next: 'CONFIRMED', label: 'Accept' },
  CONFIRMED: { next: 'PREPARING', label: 'Start preparing' },
  PREPARING: { next: 'READY', label: 'Mark ready' },
};

function terminalFor(orderType: OrderType): { next: OrderStatus; label: string } {
  if (orderType === 'DELIVERY') return { next: 'OUT_FOR_DELIVERY', label: 'Hand to rider' };
  if (orderType === 'PICKUP') return { next: 'COLLECTED', label: 'Collected' };
  return { next: 'SERVED', label: 'Served' };
}

const TYPE_ICON: Record<OrderType, typeof Bike> = {
  DELIVERY: Bike,
  PICKUP: Store,
  DINE_IN: QrCode,
};

const COLUMNS: { key: keyof KitchenBoardShape; title: string; hint: string }[] = [
  { key: 'NEW', title: 'New', hint: 'Waiting to be accepted' },
  { key: 'PREPARING', title: 'Preparing', hint: 'On the pass' },
  { key: 'READY', title: 'Ready', hint: 'Waiting for handover' },
  { key: 'COMPLETED', title: 'Out', hint: 'With the rider' },
];

type KitchenBoardShape = { NEW: KitchenCard[]; PREPARING: KitchenCard[]; READY: KitchenCard[]; COMPLETED: KitchenCard[] };

/**
 * Kitchen Display System. Built for a wall-mounted tablet or monitor: large
 * type, four fixed columns, and no hover-dependent controls. Colour is used
 * sparingly — only lateness earns an accent.
 */
export default function Kitchen() {
  useSeo({ title: 'Kitchen display' });

  const queryClient = useQueryClient();
  const { user } = useAuth();
  useTicker(30_000); // re-render so order ages stay honest between fetches

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['kitchen-board'],
    queryFn: () => adminApi.kitchenBoard().then((response) => response.board),
    refetchInterval: 25_000, // polling fallback when websockets are unavailable
  });

  const isLive = useKitchenSocket(() => {
    void queryClient.invalidateQueries({ queryKey: ['kitchen-board'] });
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus; label: string }) =>
      adminApi.updateOrderStatus(id, status),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen-board'] });
      toast.success(`${variables.label} — customer notified`);
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const board = data;
  const totalLive = board ? board.NEW.length + board.PREPARING.length + board.READY.length : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* ── operational header ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-cream/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
          <div className="flex items-center gap-5">
            <Logo />
            <span className="hidden h-6 w-px bg-border sm:block" />
            <div>
              <h1 className="font-display text-lg leading-none text-foreground">Kitchen display</h1>
              <p className="mt-1 font-sans text-xs text-muted-foreground">
                {totalLive} live {totalLive === 1 ? 'order' : 'orders'} · {user?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
              <Radio className={cn('h-3 w-3', isLive ? 'animate-pulse text-olive' : 'text-muted-foreground')} aria-hidden />
              <span className="font-sans text-[0.6875rem] text-muted-foreground">
                {isLive ? 'Live' : 'Polling'}
              </span>
            </span>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-3.5 w-3.5" />
                Exit
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {isError && (
        <ErrorState
          title="Unable to load the board"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      )}

      {/* ── columns ── */}
      <div className="flex-1 p-4 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const cards = board?.[column.key] ?? [];

            return (
              <section key={column.key} className="flex min-w-0 flex-col" aria-labelledby={`col-${column.key}`}>
                <div className="mb-3.5 flex items-baseline justify-between gap-2 border-b border-border pb-2.5">
                  <h2
                    id={`col-${column.key}`}
                    className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-foreground"
                  >
                    {column.title}
                  </h2>
                  <span className="font-sans text-sm font-semibold tabular-nums text-muted-foreground">
                    {cards.length}
                  </span>
                </div>

                {isLoading && (
                  <div className="space-y-3">
                    <Skeleton className="h-52 rounded-lg" />
                    <Skeleton className="h-40 rounded-lg" />
                  </div>
                )}

                {!isLoading && cards.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center font-sans text-xs text-muted-foreground">
                    {column.hint}
                  </p>
                )}

                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {cards.map((card) => (
                      <motion.li
                        key={card.id}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <KitchenOrderCard
                          card={card}
                          onAdvance={(status, label) => advance.mutate({ id: card.id, status, label })}
                          isPending={advance.isPending && advance.variables?.id === card.id}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KitchenOrderCard({
  card,
  onAdvance,
  isPending,
}: {
  card: KitchenCard;
  onAdvance: (status: OrderStatus, label: string) => void;
  isPending: boolean;
}) {
  const TypeIcon = TYPE_ICON[card.orderType];
  const step = ADVANCE[card.orderStatus] ?? (card.orderStatus === 'READY' ? terminalFor(card.orderType) : undefined);
  const finalStep = card.orderStatus === 'OUT_FOR_DELIVERY' ? { next: 'DELIVERED' as OrderStatus, label: 'Delivered' } : undefined;
  const action = step ?? finalStep;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-lg border bg-card',
        // Lateness is the only thing that gets colour, and only a border tint.
        card.isUrgent ? 'border-terracotta/55 shadow-subtle' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="font-display text-xl leading-none tabular-nums text-foreground">{card.orderNumber}</p>
          <p className="mt-1.5 flex items-center gap-1.5 font-sans text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
            <TypeIcon className="h-3 w-3" aria-hidden />
            {card.orderType === 'DINE_IN' ? `Dine-in · Table ${card.table?.label ?? '—'}` : card.orderType === 'DELIVERY' ? 'Delivery' : 'Pickup'}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              'flex items-center gap-1 font-sans text-xs font-semibold tabular-nums',
              card.isUrgent ? 'text-terracotta' : 'text-muted-foreground',
            )}
          >
            <Timer className="h-3 w-3" aria-hidden />
            {card.ageMinutes}m
          </span>
          {card.isScheduled && (
            <Badge variant="outline" size="sm">
              <Clock className="h-2.5 w-2.5" aria-hidden />
              {card.minutesUntilScheduled !== null && card.minutesUntilScheduled > 0
                ? `in ${card.minutesUntilScheduled}m`
                : 'due'}
            </Badge>
          )}
          {card.isUrgent && !card.isScheduled && (
            <Badge variant="accent" size="sm">
              Overdue
            </Badge>
          )}
        </div>
      </div>

      {/* ── items: the part staff actually read from across the room ── */}
      <ul className="divide-y divide-border/60">
        {card.items.map((item) => (
          <li key={item.id} className="px-4 py-3">
            <p className="font-sans text-[0.9375rem] font-semibold leading-snug text-foreground">
              <span className="tabular-nums">{item.quantity} ×</span> {item.name}
            </p>
            {item.modifiers.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {item.modifiers.map((modifier, index) => (
                  <li key={`${item.id}-${index}`} className="font-sans text-[0.8125rem] leading-snug text-muted-foreground">
                    {modifier.option}
                  </li>
                ))}
              </ul>
            )}
            {item.notes && (
              <p className="mt-1.5 rounded bg-terracotta/[0.08] px-2 py-1 font-sans text-xs italic text-foreground">
                {item.notes}
              </p>
            )}
          </li>
        ))}
      </ul>

      {card.notes && (
        <p className="border-t border-border bg-secondary/60 px-4 py-2.5 font-sans text-xs italic text-foreground">
          Order note: {card.notes}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="font-sans text-xs text-muted-foreground">
          {card.paymentStatus === 'SUCCESS' ? 'Paid' : card.paymentMethod === 'PAY_AT_COUNTER' ? 'Pay at counter' : card.paymentMethod === 'COD' ? 'Cash on delivery' : 'Unpaid'}
          {' · '}
          <span className="tabular-nums">{formatINR(card.total)}</span>
        </span>

        {action && (
          <Button size="sm" loading={isPending} onClick={() => onAdvance(action.next, action.label)}>
            {action.label}
          </Button>
        )}
      </div>
    </article>
  );
}
