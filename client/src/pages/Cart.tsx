import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuantityStepper, Separator } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/States';
import { useCart, useClearCart, useRemoveCartItem, useUpdateCartItem } from '@/hooks/useCart';
import { useSeo } from '@/hooks/useUtils';
import { formatINR, pluralise } from '@/lib/utils';
import type { CartLine } from '@/types';

export default function Cart() {
  useSeo({ title: 'Your order', description: 'Review your order before checkout.', canonicalPath: '/cart' });

  const { data: cart, isLoading } = useCart();
  const clearCart = useClearCart();

  const lines = cart?.lines ?? [];
  const unavailable = cart?.unavailableLines ?? [];
  const totals = cart?.totals;

  if (isLoading) {
    return (
      <div className="container py-12">
        <Skeleton className="h-10 w-48" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex gap-4">
                <Skeleton className="h-24 w-24 shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (lines.length === 0 && unavailable.length === 0) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your table is waiting."
          description="There’s nothing in your order yet. Have a look at what the kitchen is making today."
          action={{ label: 'Explore the menu', to: '/menu' }}
          className="rounded-lg border border-border bg-card"
        />
      </div>
    );
  }

  return (
    <div className="container py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your order</p>
          <h1 className="mt-3 text-display-sm text-foreground">
            {pluralise(cart?.itemCount ?? 0, 'item')} in your cart
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => clearCart.mutate()} loading={clearCart.isPending}>
          <Trash2 className="h-3.5 w-3.5" />
          Clear cart
        </Button>
      </div>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        {/* ── lines ── */}
        <div>
          {unavailable.length > 0 && (
            <div
              role="alert"
              className="mb-6 flex gap-3 rounded-md border border-destructive/25 bg-destructive/[0.04] p-4"
            >
              <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="font-sans text-sm font-medium text-foreground">
                  {unavailable.length === 1 ? 'One item is' : `${unavailable.length} items are`} no longer available
                </p>
                <p className="mt-1 font-sans text-[0.8125rem] text-muted-foreground">
                  Please remove {unavailable.length === 1 ? 'it' : 'them'} to continue to checkout.
                </p>
              </div>
            </div>
          )}

          <ul className="divide-y divide-border border-y border-border">
            {[...lines, ...unavailable].map((line) => (
              <CartPageLine key={line.id} line={line} />
            ))}
          </ul>

          <Button asChild variant="outline" className="mt-7">
            <Link to="/menu">Continue shopping</Link>
          </Button>
        </div>

        {/* ── summary ── */}
        {totals && (
          <aside className="lg:sticky lg:top-28">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-display text-xl text-foreground">Order summary</h2>

              <dl className="mt-6 space-y-3 font-sans text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums text-foreground">{formatINR(totals.subtotal)}</dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-olive">
                    <dt>Discount{cart?.coupon ? ` (${cart.coupon.code})` : ''}</dt>
                    <dd className="tabular-nums">−{formatINR(totals.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">GST ({totals.taxRatePercent}%)</dt>
                  <dd className="tabular-nums text-foreground">{formatINR(totals.tax)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="tabular-nums text-foreground">
                    {totals.deliveryFee === 0 ? (
                      <span className="text-olive">Free</span>
                    ) : (
                      formatINR(totals.deliveryFee)
                    )}
                  </dd>
                </div>
              </dl>

              <Separator className="my-5" />

              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg text-foreground">Total</span>
                <span className="font-display text-2xl text-foreground tabular-nums">{formatINR(totals.total)}</span>
              </div>

              {totals.amountToFreeDelivery > 0 && (
                <p className="mt-4 rounded-md bg-olive/10 px-3.5 py-2.5 font-sans text-xs text-olive">
                  Add {formatINR(totals.amountToFreeDelivery)} more and delivery is on us.
                </p>
              )}

              <Button asChild size="lg" className="mt-6 w-full" disabled={unavailable.length > 0}>
                <Link to="/checkout">
                  Proceed to checkout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <p className="mt-4 text-center font-sans text-xs leading-relaxed text-muted-foreground">
                Delivery fee and tax are confirmed at checkout once you choose delivery, pickup or dine-in.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function CartPageLine({ line }: { line: CartLine }) {
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  return (
    <li className="flex gap-4 py-6 sm:gap-5">
      <Link to={`/menu/${line.slug}`} className="group shrink-0">
        <div className="media h-24 w-24 rounded-md sm:h-28 sm:w-28">
          <img src={line.image} alt="" width={224} height={224} loading="lazy" />
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/menu/${line.slug}`}
              className="font-display text-[1.0625rem] leading-snug text-foreground hover:text-accent"
            >
              {line.name}
            </Link>
            {line.modifierSummary && (
              <p className="mt-1.5 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
                {line.modifierSummary}
              </p>
            )}
            {line.notes && (
              <p className="mt-1 font-sans text-[0.8125rem] italic text-muted-foreground">“{line.notes}”</p>
            )}
            <p className="mt-1.5 font-sans text-xs tabular-nums text-muted-foreground">
              {formatINR(line.unitPrice)} each
            </p>
            {!line.isAvailable && (
              <p className="mt-2 font-sans text-[0.8125rem] font-medium text-destructive">
                Currently unavailable — please remove
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => removeItem.mutate(line.id)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${line.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <QuantityStepper
            value={line.quantity}
            onChange={(quantity) => updateItem.mutate({ id: line.id, quantity })}
            disabled={updateItem.isPending || !line.isAvailable}
          />
          <span className="font-display text-lg tabular-nums text-foreground">{formatINR(line.subtotal)}</span>
        </div>
      </div>
    </li>
  );
}
