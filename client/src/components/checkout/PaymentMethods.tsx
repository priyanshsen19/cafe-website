import { Banknote, CreditCard, Landmark, Smartphone, Store } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/form-controls';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderType, PaymentMethod } from '@/types';

const METHODS: Record<PaymentMethod, { label: string; hint: string; icon: typeof CreditCard }> = {
  UPI: { label: 'UPI', hint: 'GPay, PhonePe, Paytm or any UPI app', icon: Smartphone },
  CARD: { label: 'Card', hint: 'Credit or debit card', icon: CreditCard },
  NETBANKING: { label: 'Net banking', hint: 'Pay from your bank account', icon: Landmark },
  COD: { label: 'Cash on delivery', hint: 'Pay the rider when it arrives', icon: Banknote },
  PAY_AT_COUNTER: { label: 'Pay at counter', hint: 'Settle up when you collect', icon: Store },
};

/**
 * Only the methods that make sense for this fulfilment type are offered — cash
 * on delivery has no meaning for a dine-in order, and pay-at-counter has none
 * for delivery. The server enforces the same matrix.
 */
const ALLOWED: Record<OrderType, PaymentMethod[]> = {
  DELIVERY: ['UPI', 'CARD', 'NETBANKING', 'COD'],
  PICKUP: ['UPI', 'CARD', 'NETBANKING', 'PAY_AT_COUNTER'],
  DINE_IN: ['UPI', 'CARD', 'NETBANKING', 'PAY_AT_COUNTER'],
};

export function methodsFor(orderType: OrderType): PaymentMethod[] {
  return ALLOWED[orderType];
}

const CASH_METHODS: PaymentMethod[] = ['COD', 'PAY_AT_COUNTER'];

/**
 * Narrows the list again to what the gateway will accept. Cash never depends
 * on the gateway, so it always survives; `enabledOnline` being undefined means
 * the answer hasn't arrived yet, and withholding methods on a slow response
 * would be worse than briefly offering one.
 */
export function availableMethods(orderType: OrderType, enabledOnline?: PaymentMethod[]): PaymentMethod[] {
  const options = methodsFor(orderType);
  if (!enabledOnline) return options;
  return options.filter((method) => CASH_METHODS.includes(method) || enabledOnline.includes(method));
}

export function PaymentMethods({
  orderType,
  value,
  onChange,
  paymentMode,
  enabledOnline,
}: {
  orderType: OrderType;
  value: PaymentMethod;
  onChange: (next: PaymentMethod) => void;
  paymentMode?: 'razorpay' | 'mock';
  /** Online methods the gateway accepts; undefined until the answer arrives. */
  enabledOnline?: PaymentMethod[];
}) {
  const options = methodsFor(orderType);

  // Unavailable methods are shown greyed out rather than removed: a customer
  // who came here intending to pay by UPI deserves to see why they can't,
  // not to silently wonder where the option went.
  const isUnavailable = (method: PaymentMethod) =>
    Boolean(enabledOnline) && !CASH_METHODS.includes(method) && !enabledOnline!.includes(method);

  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as PaymentMethod)}
      className="gap-0 divide-y divide-border overflow-hidden rounded-lg border border-border"
      aria-label="Payment method"
    >
      {options.map((method) => {
        const { label, hint, icon: Icon } = METHODS[method];
        const isSelected = value === method;
        const isOnline = !CASH_METHODS.includes(method);
        const unavailable = isUnavailable(method);

        return (
          <label
            key={method}
            className={cn(
              'flex items-center gap-3.5 px-4 py-4 transition-colors',
              unavailable
                ? 'cursor-not-allowed opacity-55'
                : cn('cursor-pointer', isSelected ? 'bg-secondary/80' : 'hover:bg-secondary/50'),
            )}
          >
            <RadioGroupItem value={method} id={`payment-${method}`} disabled={unavailable} />
            <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-sans text-[0.9375rem] font-medium text-foreground">{label}</span>
                {unavailable ? (
                  <Badge variant="subtle" size="sm">
                    Unavailable
                  </Badge>
                ) : (
                  isOnline &&
                  paymentMode === 'mock' && (
                    <Badge variant="subtle" size="sm">
                      Simulated
                    </Badge>
                  )
                )}
              </span>
              <span className="mt-0.5 block font-sans text-xs text-muted-foreground">
                {unavailable ? 'Not enabled on this payment gateway account yet' : hint}
              </span>
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
