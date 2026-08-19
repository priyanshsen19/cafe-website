import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Heart, Timer, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { Checkbox, QuantityStepper, RadioGroup, RadioGroupItem, Separator } from '@/components/ui/form-controls';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { DietaryLabels, VegMark } from '@/components/common/DietMark';
import { Rating } from '@/components/common/Rating';
import { ErrorState } from '@/components/common/States';
import { menuApi } from '@/api/endpoints';
import { useAddToCart } from '@/hooks/useCart';
import { useToggleWishlist, useWishlistIds } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatINR } from '@/lib/utils';
import type { ModifierGroup, ProductDetail } from '@/types';

/**
 * Product detail and customisation. Prices shown here are computed from the same
 * base-price-plus-deltas rule the server uses, and the server recomputes and
 * validates the whole selection when the item is added — the client's arithmetic
 * is a preview, never the source of truth.
 */
export function ProductModal({
  slug,
  open,
  onOpenChange,
}: {
  slug: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => menuApi.product(slug!).then((response) => response.product),
    enabled: Boolean(slug) && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="p-0">
        {isLoading && <ProductModalSkeleton />}

        {isError && (
          <div className="p-6">
            <DialogTitle className="sr-only">Unable to load dish</DialogTitle>
            <ErrorState
              title="Unable to load this dish"
              message={error instanceof Error ? error.message : undefined}
              onRetry={() => void refetch()}
            />
          </div>
        )}

        {data && <ProductModalBody product={data} onAdded={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ProductModalBody({ product, onAdded }: { product: ProductDetail; onAdded: () => void }) {
  const addToCart = useAddToCart();
  const toggleWishlist = useToggleWishlist();
  const { data: savedIds } = useWishlistIds();
  const { isAuthenticated } = useAuth();
  const isSaved = savedIds?.includes(product.id) ?? false;

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selection, setSelection] = useState<Record<string, string[]>>({});

  // Pre-select each group's default so the modal opens on a valid, orderable state.
  useEffect(() => {
    const initial: Record<string, string[]> = {};
    for (const group of product.modifierGroups) {
      const fallback = group.options.find((option) => option.isDefault && option.isAvailable);
      const first = group.options.find((option) => option.isAvailable);
      const chosen = fallback ?? (group.isRequired ? first : undefined);
      initial[group.id] = chosen ? [chosen.id] : [];
    }
    setSelection(initial);
    setQuantity(1);
    setNotes('');
  }, [product.id, product.modifierGroups]);

  const selectedOptionIds = useMemo(() => Object.values(selection).flat(), [selection]);

  const { unitPrice, extras } = useMemo(() => {
    let delta = 0;
    const chosen: { name: string; priceDelta: number }[] = [];

    for (const group of product.modifierGroups) {
      for (const option of group.options) {
        if (selection[group.id]?.includes(option.id)) {
          delta += option.priceDelta;
          chosen.push({ name: option.name, priceDelta: option.priceDelta });
        }
      }
    }
    return { unitPrice: product.basePrice + delta, extras: chosen };
  }, [product, selection]);

  // Mirrors the server's validation so the button explains itself before submit.
  const missingGroup = product.modifierGroups.find((group) => {
    const count = selection[group.id]?.length ?? 0;
    return group.isRequired && count < Math.max(group.minSelect, 1);
  });

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    setSelection((current) => {
      const existing = current[group.id] ?? [];

      if (group.selectionType === 'SINGLE') {
        return { ...current, [group.id]: [optionId] };
      }

      if (existing.includes(optionId)) {
        return { ...current, [group.id]: existing.filter((id) => id !== optionId) };
      }

      const max = Math.max(group.maxSelect, 1);
      if (existing.length >= max) return current;

      return { ...current, [group.id]: [...existing, optionId] };
    });
  };

  const handleAdd = () => {
    addToCart.mutate(
      {
        productId: product.id,
        quantity,
        modifierOptionIds: selectedOptionIds,
        notes: notes.trim() || undefined,
      },
      { onSuccess: onAdded },
    );
  };

  return (
    <div className="grid max-h-[92dvh] grid-rows-[auto_1fr_auto] overflow-hidden md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:grid-rows-1">
      {/* ── imagery ── */}
      <div className="relative hidden bg-muted md:block">
        <img
          src={product.images[0]?.url ?? product.imageUrl}
          alt={product.images[0]?.alt ?? product.name}
          className="h-full w-full object-cover"
          width={1200}
          height={1200}
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
          {product.isBestseller && (
            <Badge variant="accent" size="sm">
              Bestseller
            </Badge>
          )}
          {product.isChefSpecial && (
            <Badge variant="paper" size="sm">
              Chef’s Special
            </Badge>
          )}
        </div>
      </div>

      {/* Mobile gets a short banner image rather than a tall panel. */}
      <div className="media aspect-[16/9] md:hidden">
        <img src={product.imageUrl} alt={product.name} width={800} height={450} />
      </div>

      {/* ── detail ── */}
      <div className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="eyebrow mb-2.5">{product.category.name}</p>

          <div className="flex items-start gap-2.5 pr-10">
            <VegMark isVegetarian={product.isVegetarian} className="mt-1.5" />
            <DialogTitle className="text-[1.625rem] leading-tight">{product.name}</DialogTitle>
          </div>

          <DialogDescription className="mt-2.5">{product.description}</DialogDescription>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            {product.ratingCount > 0 && (
              <Rating value={product.ratingAvg} count={product.ratingCount} showValue size="sm" />
            )}
            <span className="inline-flex items-center gap-1.5 font-sans text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" aria-hidden />
              {product.prepTimeMinutes} min
            </span>
            {product.calories !== null && (
              <span className="inline-flex items-center gap-1.5 font-sans text-xs text-muted-foreground">
                <Flame className="h-3.5 w-3.5" aria-hidden />
                {product.calories} kcal
              </span>
            )}
          </div>

          <DietaryLabels product={product} className="mt-3.5" />

          {product.story && (
            <p className="mt-5 border-l-2 border-terracotta/40 pl-4 font-display text-[0.9375rem] italic leading-relaxed text-muted-foreground">
              {product.story}
            </p>
          )}

          {/* ── customisation ── */}
          {product.modifierGroups.length > 0 && (
            <div className="mt-6 space-y-6">
              {product.modifierGroups.map((group) => {
                const chosen = selection[group.id] ?? [];
                const max = Math.max(group.maxSelect, 1);
                const atLimit = group.selectionType === 'MULTI' && chosen.length >= max;

                return (
                  <fieldset key={group.id}>
                    <legend className="mb-3 flex w-full items-baseline justify-between gap-3">
                      <span className="font-sans text-[0.9375rem] font-medium text-foreground">
                        {group.name}
                        {group.isRequired && <span className="ml-1.5 text-xs text-accent">Required</span>}
                      </span>
                      <span className="font-sans text-[0.6875rem] text-muted-foreground">
                        {group.selectionType === 'SINGLE' ? 'Choose one' : `Up to ${max}`}
                      </span>
                    </legend>

                    {group.description && (
                      <p className="mb-3 font-sans text-xs text-muted-foreground">{group.description}</p>
                    )}

                    {group.selectionType === 'SINGLE' ? (
                      <RadioGroup
                        value={chosen[0] ?? ''}
                        onValueChange={(value) => toggleOption(group, value)}
                        className="gap-0 divide-y divide-border overflow-hidden rounded-md border border-border"
                      >
                        {group.options.map((option) => (
                          <label
                            key={option.id}
                            htmlFor={option.id}
                            className={cn(
                              'flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors',
                              option.isAvailable ? 'hover:bg-secondary/60' : 'cursor-not-allowed opacity-45',
                              chosen[0] === option.id && 'bg-secondary/80',
                            )}
                          >
                            <RadioGroupItem value={option.id} id={option.id} disabled={!option.isAvailable} />
                            <span className="flex-1 font-sans text-sm text-foreground">{option.name}</span>
                            {option.priceDelta > 0 && (
                              <span className="font-sans text-sm tabular-nums text-muted-foreground">
                                +{formatINR(option.priceDelta)}
                              </span>
                            )}
                          </label>
                        ))}
                      </RadioGroup>
                    ) : (
                      <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
                        {group.options.map((option) => {
                          const isChecked = chosen.includes(option.id);
                          const isDisabled = !option.isAvailable || (atLimit && !isChecked);

                          return (
                            <label
                              key={option.id}
                              className={cn(
                                'flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors',
                                isDisabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-secondary/60',
                                isChecked && 'bg-secondary/80',
                              )}
                            >
                              <Checkbox
                                checked={isChecked}
                                disabled={isDisabled}
                                onCheckedChange={() => toggleOption(group, option.id)}
                                aria-label={option.name}
                              />
                              <span className="flex-1 font-sans text-sm text-foreground">{option.name}</span>
                              {option.priceDelta > 0 && (
                                <span className="font-sans text-sm tabular-nums text-muted-foreground">
                                  +{formatINR(option.priceDelta)}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                );
              })}
            </div>
          )}

          <div className="mt-6">
            <label htmlFor="item-notes" className="mb-2 block font-sans text-[0.9375rem] font-medium text-foreground">
              Anything else?
            </label>
            <Textarea
              id="item-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Less ice, extra hot, allergy notes…"
              maxLength={200}
              className="min-h-[4.5rem]"
            />
          </div>

          {product.allergens.length > 0 && (
            <div className="mt-5 flex gap-2.5 rounded-md bg-secondary/70 p-3.5">
              <Info className="mt-px h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-sans text-xs font-medium text-foreground">Allergens</p>
                <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
                  Contains {product.allergens.join(', ').toLowerCase()}. Our kitchen handles nuts, gluten, egg and
                  dairy — please tell us about allergies when you order.
                </p>
              </div>
            </div>
          )}

          {product.ingredients.length > 0 && (
            <div className="mt-5">
              <p className="font-sans text-xs font-medium text-foreground">Made with</p>
              <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted-foreground">
                {product.ingredients.join(' · ')}
              </p>
            </div>
          )}

          {product.reviews.length > 0 && (
            <div className="mt-6">
              <Separator className="mb-5" />
              <p className="mb-4 font-sans text-[0.9375rem] font-medium text-foreground">
                What people say
              </p>
              <ul className="space-y-4">
                {product.reviews.slice(0, 3).map((review) => (
                  <li key={review.id}>
                    <Rating value={review.rating} size="sm" />
                    {review.title && (
                      <p className="mt-1.5 font-display text-[0.9375rem] text-foreground">“{review.title}”</p>
                    )}
                    <p className="mt-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
                      {review.comment}
                    </p>
                    <p className="mt-1.5 font-sans text-[0.6875rem] text-muted-foreground">
                      {review.user.name}
                      {review.isVerified && <span className="ml-1.5 text-olive">· Verified order</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── sticky action bar ── */}
        <div className="shrink-0 border-t border-border bg-card px-5 py-4 sm:px-6">
          {extras.length > 0 && (
            <p className="mb-3 truncate font-sans text-xs text-muted-foreground">
              {extras.map((extra) => extra.name).join(' · ')}
            </p>
          )}

          <div className="flex items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} max={30} />

            {isAuthenticated && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => toggleWishlist.mutate({ productId: product.id, isSaved })}
                aria-label={isSaved ? 'Remove from favourites' : 'Save to favourites'}
                aria-pressed={isSaved}
              >
                <Heart className={cn('h-4 w-4', isSaved && 'fill-accent text-accent')} />
              </Button>
            )}

            <Button
              className="flex-1"
              onClick={handleAdd}
              loading={addToCart.isPending}
              disabled={!product.isAvailable || Boolean(missingGroup)}
            >
              {!product.isAvailable
                ? 'Currently unavailable'
                : missingGroup
                  ? `Choose a ${missingGroup.name.toLowerCase()}`
                  : `Add · ${formatINR(unitPrice * quantity)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductModalSkeleton() {
  return (
    <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <DialogTitle className="sr-only">Loading dish</DialogTitle>
      <Skeleton className="hidden aspect-square rounded-none md:block" />
      <Skeleton className="aspect-[16/9] rounded-none md:hidden" />
      <div className="space-y-5 p-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-3/5" />
        <SkeletonText lines={2} />
        <Skeleton className="h-4 w-32" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
