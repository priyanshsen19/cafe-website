import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { QuantityStepper, Separator } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/States';
import { useCart, useRemoveCartItem, useUpdateCartItem } from '@/hooks/useCart';
import { useUiStore } from '@/store/ui';
import { formatINR, pluralise } from '@/lib/utils';
import type { CartLine } from '@/types';

/**
 * The mini cart. Adding an item from the menu opens this rather than navigating
 * away, so a customer can keep browsing while their order builds.
 */
export function CartDrawer() {
  const isOpen = useUiStore((state) => state.isCartOpen);
  const setCartOpen = useUiStore((state) => state.setCartOpen);
  const { data: cart, isLoading } = useCart();

  const lines = cart?.lines ?? [];
  const unavailable = cart?.unavailableLines ?? [];
  const totals = cart?.totals;

  return (
    <Sheet open={isOpen} onOpenChange={setCartOpen}>
      <SheetContent side="right" className="p-0">
        <SheetHeader>
          <SheetTitle>Your order</SheetTitle>
          {lines.length > 0 && (
            <p className="mt-0.5 font-sans text-xs text-muted-foreground">
              {pluralise(cart?.itemCount ?? 0, 'item')}
            </p>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && (
            <div className="space-y-5 p-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex gap-3.5">
                  <Skeleton className="h-16 w-16 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && lines.length === 0 && unavailable.length === 0 && (
            <EmptyState
              icon={ShoppingBag}
              title="Your table is waiting."
              description="Nothing in your order yet. Have a look at what we’re making today."
              action={{ label: 'Explore the menu', to: '/menu' }}
            />
          )}

          {(lines.length > 0 || unavailable.length > 0) && (
            <ul className="divide-y divide-border">
              {lines.map((line) => (
                <CartDrawerLine key={line.id} line={line} onNavigate={() => setCartOpen(false)} />
              ))}
              {unavailable.map((line) => (
                <CartDrawerLine key={line.id} line={line} onNavigate={() => setCartOpen(false)} />
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && totals && (
          <SheetFooter className="space-y-3.5">
            {totals.amountToFreeDelivery > 0 && (
              <p className="rounded-md bg-olive/10 px-3.5 py-2.5 font-sans text-xs text-olive">
                Add {formatINR(totals.amountToFreeDelivery)} more for free delivery.
              </p>
            )}

            <div className="space-y-2 font-sans text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums text-foreground">{formatINR(totals.subtotal)}</span>
              </div>
              <p className="font-sans text-xs text-muted-foreground">
                Taxes and delivery are calculated at checkout.
              </p>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Button asChild size="lg" className="w-full">
                <Link to="/checkout" onClick={() => setCartOpen(false)}>
                  Proceed to checkout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/cart" onClick={() => setCartOpen(false)}>
                  View full cart
                </Link>
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CartDrawerLine({ line, onNavigate }: { line: CartLine; onNavigate: () => void }) {
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  return (
    <li className="flex gap-3.5 p-5">
      <Link to={`/menu/${line.slug}`} onClick={onNavigate} className="group shrink-0">
        <div className="media h-16 w-16 rounded-md">
          <img src={line.image} alt="" width={128} height={128} loading="lazy" />
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/menu/${line.slug}`}
            onClick={onNavigate}
            className="font-display text-[0.9375rem] leading-snug text-foreground hover:text-accent"
          >
            {line.name}
          </Link>
          <button
            type="button"
            onClick={() => removeItem.mutate(line.id)}
            className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${line.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {line.modifierSummary && (
          <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">{line.modifierSummary}</p>
        )}
        {line.notes && <p className="mt-1 font-sans text-xs italic text-muted-foreground">“{line.notes}”</p>}

        {!line.isAvailable && (
          <p className="mt-1.5 font-sans text-xs text-destructive">Currently unavailable — please remove</p>
        )}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <QuantityStepper
            size="sm"
            value={line.quantity}
            onChange={(quantity) => updateItem.mutate({ id: line.id, quantity })}
            min={1}
            disabled={updateItem.isPending || !line.isAvailable}
          />
          <span className="font-sans text-sm font-medium tabular-nums text-foreground">
            {formatINR(line.subtotal)}
          </span>
        </div>
      </div>
    </li>
  );
}
