import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductGridSkeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/menu/ProductCard';
import { ProductModal } from '@/components/menu/ProductModal';
import { EmptyState, ErrorState } from '@/components/common/States';
import { menuApi } from '@/api/endpoints';
import { useSeo } from '@/hooks/useUtils';
import { pluralise } from '@/lib/utils';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const term = searchParams.get('q')?.trim() ?? '';
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useSeo({ title: term ? `Search: ${term}` : 'Search', canonicalPath: '/search' });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', 'search-page', term],
    queryFn: () => menuApi.products({ q: term, pageSize: 60 }),
    enabled: term.length >= 2,
  });

  const products = data?.items ?? [];

  return (
    <>
      <div className="border-b border-border bg-paper">
        <div className="container py-12">
          <p className="eyebrow">Search</p>
          <h1 className="mt-4 text-display-sm text-foreground">
            {term ? <>Results for “{term}”</> : 'Search the menu'}
          </h1>
          {term.length >= 2 && !isLoading && (
            <p className="mt-3 font-sans text-sm text-muted-foreground" aria-live="polite">
              {pluralise(data?.pagination.total ?? 0, 'dish', 'dishes')} found
            </p>
          )}
        </div>
      </div>

      <div className="container py-10">
        {term.length < 2 && (
          <EmptyState
            icon={SearchX}
            title="What are you after?"
            description="Search by dish, ingredient or category — “oat”, “truffle”, “matcha” all work."
            action={{ label: 'Browse the menu', to: '/menu' }}
          />
        )}

        {isError && (
          <ErrorState
            title="Search is unavailable"
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => void refetch()}
          />
        )}

        {isLoading && term.length >= 2 && <ProductGridSkeleton count={8} />}

        {term.length >= 2 && !isLoading && !isError && products.length === 0 && (
          <EmptyState
            icon={SearchX}
            title={`Nothing matched “${term}”`}
            description="Try a shorter word, or have a look at the full menu instead."
            action={{ label: 'Browse the menu', to: '/menu' }}
          />
        )}

        {products.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={setOpenSlug} />
              ))}
            </div>
            <div className="mt-12 text-center">
              <Button asChild variant="outline">
                <Link to="/menu">See the full menu</Link>
              </Button>
            </div>
          </>
        )}
      </div>

      <ProductModal slug={openSlug} open={Boolean(openSlug)} onOpenChange={(open) => !open && setOpenSlug(null)} />
    </>
  );
}
