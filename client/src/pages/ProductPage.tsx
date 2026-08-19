import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Flame, Heart, Info, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { Checkbox, QuantityStepper, RadioGroup, RadioGroupItem, Separator } from '@/components/ui/form-controls';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { DietaryLabels, VegMark } from '@/components/common/DietMark';
import { Rating } from '@/components/common/Rating';
import { ErrorState } from '@/components/common/States';
import { Reveal } from '@/components/common/Reveal';
import { ProductCard } from '@/components/menu/ProductCard';
import { ProductModal } from '@/components/menu/ProductModal';
import { menuApi } from '@/api/endpoints';
import { useAddToCart } from '@/hooks/useCart';
import { useToggleWishlist, useWishlistIds } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/hooks/useUtils';
import { cn, formatDate, formatINR } from '@/lib/utils';
import type { ModifierGroup } from '@/types';

/**
 * The full dish page. Same customisation logic as the modal, but laid out as a
 * shareable, indexable page — which is what a URL like
 * /menu/truffle-mushroom-pasta should give you.
 */
export default function ProductPage({ slug }: { slug: string }) {
  const { data: product, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => menuApi.product(slug).then((response) => response.product),
  });

  useSeo({
    title: product?.name ?? 'Menu',
    description: product?.description,
    canonicalPath: `/menu/${slug}`,
  });

  const addToCart = useAddToCart();
  const toggleWishlist = useToggleWishlist();
  const { data: savedIds } = useWishlistIds();
  const { isAuthenticated } = useAuth();

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [relatedSlug, setRelatedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    const initial: Record<string, string[]> = {};
    for (const group of product.modifierGroups) {
      const preferred = group.options.find((option) => option.isDefault && option.isAvailable);
      const first = group.options.find((option) => option.isAvailable);
      const chosen = preferred ?? (group.isRequired ? first : undefined);
      initial[group.id] = chosen ? [chosen.id] : [];
    }
    setSelection(initial);
    setQuantity(1);
    setNotes('');
  }, [product]);

  const selectedOptionIds = useMemo(() => Object.values(selection).flat(), [selection]);

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    let delta = 0;
    for (const group of product.modifierGroups) {
      for (const option of group.options) {
        if (selection[group.id]?.includes(option.id)) delta += option.priceDelta;
      }
    }
    return product.basePrice + delta;
  }, [product, selection]);

  if (isLoading) return <ProductPageSkeleton />;

  if (isError || !product) {
    return (
      <div className="container py-24">
        <ErrorState
          title="We couldn’t find that dish"
          message={error instanceof Error ? error.message : 'It may have come off the menu.'}
          onRetry={() => void refetch()}
        />
        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link to="/menu">Back to the menu</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isSaved = savedIds?.includes(product.id) ?? false;
  const missingGroup = product.modifierGroups.find((group) => {
    const count = selection[group.id]?.length ?? 0;
    return group.isRequired && count < Math.max(group.minSelect, 1);
  });

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    setSelection((current) => {
      const existing = current[group.id] ?? [];
      if (group.selectionType === 'SINGLE') return { ...current, [group.id]: [optionId] };
      if (existing.includes(optionId)) {
        return { ...current, [group.id]: existing.filter((id) => id !== optionId) };
      }
      if (existing.length >= Math.max(group.maxSelect, 1)) return current;
      return { ...current, [group.id]: [...existing, optionId] };
    });
  };

  return (
    <>
      <div className="container py-8 lg:py-12">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-1.5 font-sans text-xs text-muted-foreground">
            <li>
              <Link to="/menu" className="transition-colors hover:text-foreground">
                Menu
              </Link>
            </li>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <li>
              <Link to={`/menu/${product.category.slug}`} className="transition-colors hover:text-foreground">
                {product.category.name}
              </Link>
            </li>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <li aria-current="page" className="text-foreground">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* ── imagery ── */}
          <Reveal>
            <div className="media aspect-[4/3] overflow-hidden rounded-lg lg:sticky lg:top-28">
              <img
                src={product.images[0]?.url ?? product.imageUrl}
                alt={product.images[0]?.alt ?? product.name}
                width={1600}
                height={1200}
                {...{ fetchpriority: 'high' }}
              />
              <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                {product.isBestseller && (
                  <Badge variant="accent" size="lg">
                    Bestseller
                  </Badge>
                )}
                {product.isChefSpecial && (
                  <Badge variant="paper" size="lg">
                    Chef’s Special
                  </Badge>
                )}
                {product.isSeasonal && (
                  <Badge variant="paper" size="lg">
                    Seasonal
                  </Badge>
                )}
              </div>
            </div>
          </Reveal>

          {/* ── detail & customisation ── */}
          <div>
            <p className="eyebrow">{product.category.name}</p>

            <div className="mt-3.5 flex items-start gap-3">
              <VegMark isVegetarian={product.isVegetarian} className="mt-2.5 h-5 w-5" />
              <h1 className="text-display-sm text-foreground text-balance">{product.name}</h1>
            </div>

            <p className="mt-4 font-sans text-[1.0625rem] leading-relaxed text-muted-foreground text-pretty">
              {product.description}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              {product.ratingCount > 0 && (
                <Rating value={product.ratingAvg} count={product.ratingCount} showValue size="lg" />
              )}
              <span className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground">
                <Timer className="h-4 w-4" aria-hidden />
                {product.prepTimeMinutes} min
              </span>
              {product.calories !== null && (
                <span className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground">
                  <Flame className="h-4 w-4" aria-hidden />
                  {product.calories} kcal
                </span>
              )}
            </div>

            <DietaryLabels product={product} className="mt-4" />

            <p className="mt-6 font-display text-3xl text-foreground tabular-nums">{formatINR(product.basePrice)}</p>

            {product.story && (
              <p className="mt-7 border-l-2 border-terracotta/40 pl-5 font-display text-base italic leading-relaxed text-muted-foreground">
                {product.story}
              </p>
            )}

            <Separator className="my-8" />

            {product.modifierGroups.length > 0 && (
              <div className="space-y-7">
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

                      {group.selectionType === 'SINGLE' ? (
                        <RadioGroup
                          value={chosen[0] ?? ''}
                          onValueChange={(value) => toggleOption(group, value)}
                          className="grid-cols-2 gap-2 sm:grid-cols-3"
                        >
                          {group.options.map((option) => (
                            <label
                              key={option.id}
                              className={cn(
                                'flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-3 transition-colors',
                                chosen[0] === option.id
                                  ? 'border-espresso bg-secondary'
                                  : 'border-border hover:border-espresso/35',
                                !option.isAvailable && 'cursor-not-allowed opacity-45',
                              )}
                            >
                              <RadioGroupItem value={option.id} disabled={!option.isAvailable} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-sans text-sm text-foreground">{option.name}</span>
                                {option.priceDelta > 0 && (
                                  <span className="block font-sans text-xs tabular-nums text-muted-foreground">
                                    +{formatINR(option.priceDelta)}
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                        </RadioGroup>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.options.map((option) => {
                            const isChecked = chosen.includes(option.id);
                            const isDisabled = !option.isAvailable || (atLimit && !isChecked);

                            return (
                              <label
                                key={option.id}
                                className={cn(
                                  'flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 py-3 transition-colors',
                                  isChecked ? 'border-espresso bg-secondary' : 'border-border hover:border-espresso/35',
                                  isDisabled && 'cursor-not-allowed opacity-45',
                                )}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onCheckedChange={() => toggleOption(group, option.id)}
                                  aria-label={option.name}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-sans text-sm text-foreground">{option.name}</span>
                                  {option.priceDelta > 0 && (
                                    <span className="block font-sans text-xs tabular-nums text-muted-foreground">
                                      +{formatINR(option.priceDelta)}
                                    </span>
                                  )}
                                </span>
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

            <div className="mt-7">
              <label htmlFor="notes" className="mb-2 block font-sans text-[0.9375rem] font-medium text-foreground">
                Anything else?
              </label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Less ice, extra hot, allergy notes…"
                maxLength={200}
              />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <QuantityStepper value={quantity} onChange={setQuantity} />

              <Button
                size="lg"
                className="min-w-[13rem] flex-1"
                disabled={!product.isAvailable || Boolean(missingGroup)}
                loading={addToCart.isPending}
                onClick={() =>
                  addToCart.mutate({
                    productId: product.id,
                    quantity,
                    modifierOptionIds: selectedOptionIds,
                    notes: notes.trim() || undefined,
                  })
                }
              >
                {!product.isAvailable
                  ? 'Currently unavailable'
                  : missingGroup
                    ? `Choose a ${missingGroup.name.toLowerCase()}`
                    : `Add to order · ${formatINR(unitPrice * quantity)}`}
              </Button>

              {isAuthenticated && (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-[3.25rem] w-[3.25rem]"
                  onClick={() => toggleWishlist.mutate({ productId: product.id, isSaved })}
                  aria-label={isSaved ? 'Remove from favourites' : 'Save to favourites'}
                  aria-pressed={isSaved}
                >
                  <Heart className={cn('h-[1.125rem] w-[1.125rem]', isSaved && 'fill-accent text-accent')} />
                </Button>
              )}
            </div>

            {product.allergens.length > 0 && (
              <div className="mt-7 flex gap-3 rounded-md bg-secondary/70 p-4">
                <Info className="mt-px h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-sans text-[0.8125rem] font-medium text-foreground">Allergens</p>
                  <p className="mt-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
                    Contains {product.allergens.join(', ').toLowerCase()}. Our kitchen handles nuts, gluten, egg and
                    dairy — please tell us about allergies when you order.
                  </p>
                </div>
              </div>
            )}

            {product.ingredients.length > 0 && (
              <div className="mt-6">
                <p className="font-sans text-[0.8125rem] font-medium text-foreground">Made with</p>
                <p className="mt-1.5 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
                  {product.ingredients.join(' · ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── reviews ── */}
        {product.reviews.length > 0 && (
          <section className="mt-20 border-t border-border pt-14">
            <h2 className="text-display-sm text-foreground">What people say</h2>
            <ul className="mt-9 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {product.reviews.map((review) => (
                <Reveal as="li" key={review.id}>
                  <Rating value={review.rating} />
                  {review.title && (
                    <p className="mt-3 font-display text-lg leading-snug text-foreground">“{review.title}”</p>
                  )}
                  <p className="mt-2.5 font-sans text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                  <p className="mt-4 font-sans text-xs text-foreground">
                    {review.user.name}
                    {review.isVerified && <span className="ml-2 text-olive">Verified order</span>}
                    <span className="ml-2 text-muted-foreground">{formatDate(review.createdAt)}</span>
                  </p>
                </Reveal>
              ))}
            </ul>
          </section>
        )}

        {/* ── related ── */}
        {product.related.length > 0 && (
          <section className="mt-20 border-t border-border pt-14">
            <h2 className="text-display-sm text-foreground">You might also like</h2>
            <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {product.related.map((related) => (
                <ProductCard key={related.id} product={related} onOpen={setRelatedSlug} />
              ))}
            </div>
          </section>
        )}
      </div>

      <ProductModal
        slug={relatedSlug}
        open={Boolean(relatedSlug)}
        onOpenChange={(open) => !open && setRelatedSlug(null)}
      />
    </>
  );
}

function ProductPageSkeleton() {
  return (
    <div className="container py-8 lg:py-12">
      <Skeleton className="mb-8 h-3 w-56" />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Skeleton className="aspect-[4/3] rounded-lg" />
        <div className="space-y-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-4/5" />
          <SkeletonText lines={3} />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-28" />
          <div className="space-y-3 pt-6">
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
          <Skeleton className="h-[3.25rem] w-full" />
        </div>
      </div>
    </div>
  );
}
