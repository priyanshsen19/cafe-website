import { useState } from 'react';
import { Heart } from 'lucide-react';
import { ProductGridSkeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/menu/ProductCard';
import { ProductModal } from '@/components/menu/ProductModal';
import { EmptyState } from '@/components/common/States';
import { useWishlist } from '@/hooks/useWishlist';
import { useSeo } from '@/hooks/useUtils';
import { pluralise } from '@/lib/utils';

export default function AccountWishlist() {
  useSeo({ title: 'My favourites', canonicalPath: '/account/wishlist' });

  const { data, isLoading } = useWishlist();
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const items = data ?? [];

  return (
    <div>
      <h2 className="font-display text-2xl text-foreground">Your favourites</h2>
      <p className="mt-2 font-sans text-sm text-muted-foreground">
        {items.length > 0
          ? `${pluralise(items.length, 'dish', 'dishes')} saved for later.`
          : 'Tap the heart on any dish to keep it here.'}
      </p>

      {isLoading && (
        <div className="mt-8">
          <ProductGridSkeleton count={4} />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={Heart}
          title="Save something delicious for later."
          description="Nothing saved yet. Tap the heart on a dish and it’ll be waiting here."
          action={{ label: 'Explore the menu', to: '/menu' }}
          className="mt-8 rounded-lg border border-border bg-card"
        />
      )}

      {items.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ProductCard key={item.id} product={item.product} onOpen={setOpenSlug} />
          ))}
        </div>
      )}

      <ProductModal slug={openSlug} open={Boolean(openSlug)} onOpenChange={(open) => !open && setOpenSlug(null)} />
    </div>
  );
}
