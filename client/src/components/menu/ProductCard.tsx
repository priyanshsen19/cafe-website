import { Heart, Plus, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DietaryLabels, VegMark } from '@/components/common/DietMark';
import { Rating } from '@/components/common/Rating';
import { useAddToCart } from '@/hooks/useCart';
import { useToggleWishlist, useWishlistIds } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatINR } from '@/lib/utils';
import type { Product } from '@/types';

/**
 * The menu card. Dishes with required customisations open the detail modal;
 * everything else can be added in a single tap straight from the grid.
 */
export function ProductCard({
  product,
  onOpen,
  className,
}: {
  product: Product;
  onOpen: (slug: string) => void;
  className?: string;
}) {
  const addToCart = useAddToCart();
  const toggleWishlist = useToggleWishlist();
  const { data: savedIds } = useWishlistIds();
  const { isAuthenticated } = useAuth();

  const isSaved = savedIds?.includes(product.id) ?? false;
  const needsChoices = (product._count?.modifiers ?? 0) > 0;

  const handleAdd = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (needsChoices) {
      onOpen(product.slug);
      return;
    }
    addToCart.mutate({ productId: product.id, quantity: 1, modifierOptionIds: [] });
  };

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 ease-editorial',
        product.isAvailable ? 'hover:-translate-y-0.5 hover:border-espresso/20 hover:shadow-card' : 'opacity-[0.72]',
        className,
      )}
    >
      {/* The whole card is one activation target, with a real button for a11y. */}
      <button
        type="button"
        onClick={() => onOpen(product.slug)}
        className="text-left"
        aria-label={`View ${product.name}`}
      >
        <div className="media aspect-[4/3]">
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width={800}
            height={600}
          />

          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
            {product.isBestseller && (
              <Badge variant="accent" size="sm">
                Bestseller
              </Badge>
            )}
            {product.isNew && !product.isBestseller && (
              <Badge variant="default" size="sm">
                New
              </Badge>
            )}
            {product.isSeasonal && (
              <Badge variant="paper" size="sm">
                Seasonal
              </Badge>
            )}
          </div>

          {!product.isAvailable && (
            <div className="absolute inset-0 grid place-items-center bg-cream/[0.78] backdrop-blur-[1px]">
              <span className="rounded-full bg-card px-3.5 py-1.5 font-sans text-xs font-medium text-foreground shadow-subtle">
                Currently unavailable
              </span>
            </div>
          )}
        </div>
      </button>

      {isAuthenticated && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleWishlist.mutate({ productId: product.id, isSaved });
          }}
          aria-label={isSaved ? `Remove ${product.name} from favourites` : `Save ${product.name} to favourites`}
          aria-pressed={isSaved}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-card/85 text-foreground/60 backdrop-blur transition-all hover:bg-card hover:text-accent"
        >
          <Heart className={cn('h-4 w-4 transition-all', isSaved && 'fill-accent text-accent')} />
        </button>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          <VegMark isVegetarian={product.isVegetarian} className="mt-[0.1875rem]" />
          <h3 className="flex-1 font-display text-[1.0625rem] leading-snug text-foreground">
            <button type="button" onClick={() => onOpen(product.slug)} className="text-left hover:text-accent">
              {product.name}
            </button>
          </h3>
        </div>

        <p className="mt-1.5 line-clamp-2 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {product.ratingCount > 0 && <Rating value={product.ratingAvg} count={product.ratingCount} size="sm" />}
          <span className="inline-flex items-center gap-1 font-sans text-[0.6875rem] text-muted-foreground">
            <Timer className="h-3 w-3" aria-hidden />
            {product.prepTimeMinutes} min
          </span>
        </div>

        <DietaryLabels product={product} limit={3} className="mt-2.5" />

        <div className="mt-4 flex items-end justify-between gap-3 pt-1">
          <div>
            <span className="font-display text-lg text-foreground tabular-nums">{formatINR(product.basePrice)}</span>
            {needsChoices && <span className="ml-1 font-sans text-[0.6875rem] text-muted-foreground">onwards</span>}
          </div>

          <Button
            size="sm"
            variant={product.isAvailable ? 'outline' : 'secondary'}
            onClick={handleAdd}
            disabled={!product.isAvailable}
            loading={addToCart.isPending}
            aria-label={
              product.isAvailable
                ? `Add ${product.name} to your order`
                : `${product.name} is currently unavailable`
            }
          >
            {product.isAvailable ? (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add
              </>
            ) : (
              'Sold out'
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}

/** Compact horizontal card used in the drawer, wishlist and reorder lists. */
export function ProductRow({ product, onOpen }: { product: Product; onOpen: (slug: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(product.slug)}
      className="group flex w-full items-center gap-3.5 rounded-md border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-secondary/60"
    >
      <div className="media h-14 w-14 shrink-0 rounded-md">
        <img src={product.imageUrl} alt="" loading="lazy" width={112} height={112} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <VegMark isVegetarian={product.isVegetarian} className="h-3.5 w-3.5" />
          <p className="truncate font-sans text-sm font-medium text-foreground">{product.name}</p>
        </div>
        <p className="truncate font-sans text-xs text-muted-foreground">{product.category.name}</p>
      </div>
      <span className="shrink-0 font-sans text-sm tabular-nums text-foreground">{formatINR(product.basePrice)}</span>
    </button>
  );
}
