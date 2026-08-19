import { useQuery } from '@tanstack/react-query';
import { Clock, QrCode, X } from 'lucide-react';
import { publicApi } from '@/api/endpoints';
import { useDineIn } from '@/contexts/DineInContext';
import { formatTime } from '@/lib/utils';

/**
 * Shown when a guest arrives by scanning a table QR. It confirms which table
 * they're sitting at, which is the reassurance that makes QR ordering work.
 */
export function DineInBanner() {
  const { session, clear } = useDineIn();
  if (!session) return null;

  return (
    <div className="bg-espresso text-cream">
      <div className="container flex items-center justify-between gap-4 py-2.5">
        <p className="flex min-w-0 items-center gap-2.5 font-sans text-xs sm:text-sm">
          <QrCode className="h-4 w-4 shrink-0 text-cream/60" aria-hidden />
          <span className="truncate">
            <span className="font-medium">Table {session.table.label}</span>
            <span className="text-cream/60"> · {session.cafe.name}</span>
            <span className="hidden text-cream/60 sm:inline"> — we’ll bring your order over.</span>
          </span>
        </p>
        <button
          type="button"
          onClick={clear}
          className="shrink-0 rounded p-1 text-cream/55 transition-colors hover:text-cream"
          aria-label="Leave table session"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Café-closed notice. Ordering isn't hidden — the customer is told they can
 * schedule instead, which is what the checkout actually allows.
 */
export function ClosedBanner() {
  const { data } = useQuery({
    queryKey: ['service-status'],
    queryFn: () => publicApi.serviceStatus(),
    // Refresh a few times an hour so the banner clears itself at opening time.
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });

  if (!data || data.isOpen) return null;

  return (
    <div className="border-b border-terracotta/25 bg-terracotta/[0.07]">
      <div className="container flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5">
        <Clock className="h-3.5 w-3.5 shrink-0 text-terracotta" aria-hidden />
        <p className="font-sans text-xs text-foreground sm:text-[0.8125rem]">
          <span className="font-medium">We’re currently closed.</span>{' '}
          <span className="text-muted-foreground">
            You can still schedule an order
            {data.nextOpensAt ? ` for ${formatTime(data.nextOpensAt)}.` : ' for tomorrow.'}
          </span>
        </p>
      </div>
    </div>
  );
}
