import { Bike, QrCode, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderType } from '@/types';

const OPTIONS: { value: OrderType; title: string; copy: string; icon: typeof Bike }[] = [
  { value: 'DELIVERY', title: 'Delivery', copy: 'Enjoy it wherever you are.', icon: Bike },
  { value: 'PICKUP', title: 'Pickup', copy: 'Skip the queue. We’ll have it ready.', icon: Store },
  { value: 'DINE_IN', title: 'Dine-in', copy: 'You’re already here. Let’s bring it to your table.', icon: QrCode },
];

/**
 * How the customer wants their order. Dine-in is only offered when a table QR
 * has actually been scanned — otherwise the option would be a dead end.
 */
export function OrderTypeSelector({
  value,
  onChange,
  dineInAvailable,
  tableLabel,
}: {
  value: OrderType;
  onChange: (next: OrderType) => void;
  dineInAvailable: boolean;
  tableLabel?: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">How would you like to enjoy your order?</legend>

      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          const isDisabled = option.value === 'DINE_IN' && !dineInAvailable;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => !isDisabled && onChange(option.value)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              className={cn(
                'group relative flex flex-col items-start rounded-lg border p-5 text-left transition-all duration-250 ease-editorial',
                isSelected
                  ? 'border-espresso bg-espresso text-cream shadow-card'
                  : 'border-border bg-card text-foreground hover:border-espresso/35 hover:shadow-subtle',
                isDisabled && 'cursor-not-allowed opacity-45 hover:border-border hover:shadow-none',
              )}
            >
              <span
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-full transition-colors',
                  isSelected ? 'bg-cream/[0.12] text-cream' : 'bg-secondary text-foreground',
                )}
              >
                <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
              </span>

              <span className="mt-4 font-display text-lg leading-none">{option.title}</span>
              <span
                className={cn(
                  'mt-2 font-sans text-[0.8125rem] leading-relaxed',
                  isSelected ? 'text-cream/70' : 'text-muted-foreground',
                )}
              >
                {option.value === 'DINE_IN' && tableLabel ? `Table ${tableLabel} — we’ll bring it over.` : option.copy}
              </span>

              {isDisabled && (
                <span className="mt-2.5 font-sans text-[0.6875rem] text-muted-foreground">
                  Scan the QR code on your table
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
