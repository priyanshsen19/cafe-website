import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductGridSkeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/menu/ProductCard';
import { ProductModal } from '@/components/menu/ProductModal';
import {
  ActiveFilterChips,
  DEFAULT_FILTERS,
  FilterSidebar,
  MobileFilterButton,
  PRICE_BOUNDS,
  SortSelect,
  type FilterState,
} from '@/components/menu/MenuFilters';
import { EmptyState, ErrorState } from '@/components/common/States';
import { Reveal } from '@/components/common/Reveal';
import { menuApi } from '@/api/endpoints';
import { useDineIn } from '@/contexts/DineInContext';
import { useSeo } from '@/hooks/useUtils';
import { useUiStore } from '@/store/ui';
import { cn, pluralise } from '@/lib/utils';

export default function Menu({ categorySlug }: { categorySlug?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const openSearch = useUiStore((state) => state.openSearch);
  const { session } = useDineIn();

  const activeCategory = categorySlug ?? searchParams.get('category') ?? undefined;

  const { data: categoryData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => menuApi.categories().then((response) => response.categories),
    staleTime: 10 * 60 * 1000,
  });

  const categories = categoryData ?? [];
  const current = categories.find((category) => category.slug === activeCategory);

  useSeo({
    title: current ? `${current.name} — Menu` : 'Menu',
    description:
      current?.description ??
      'Seventy-six dishes and drinks: specialty coffee, cold brew, matcha, breakfast, bakery, pasta, salads and desserts.',
    canonicalPath: current ? `/menu/${current.slug}` : '/menu',
  });

  const query = useMemo(
    () => ({
      category: activeCategory,
      vegetarian: filters.vegetarian || undefined,
      vegan: filters.vegan || undefined,
      spicy: filters.spicy || undefined,
      bestseller: filters.bestseller || undefined,
      isNew: filters.isNew || undefined,
      available: filters.available || undefined,
      minRating: filters.minRating > 0 ? filters.minRating : undefined,
      minPrice: filters.price[0] !== PRICE_BOUNDS[0] ? filters.price[0] : undefined,
      // The upper thumb at its maximum means "and above", so no cap is sent.
      maxPrice: filters.price[1] !== PRICE_BOUNDS[1] ? filters.price[1] : undefined,
      sort: filters.sort,
      pageSize: 100,
    }),
    [activeCategory, filters],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['products', query],
    queryFn: () => menuApi.products(query),
    placeholderData: keepPreviousData,
  });

  const products = data?.items ?? [];
  const total = data?.pagination.total ?? 0;

  const selectCategory = (slug: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set('category', slug);
    else next.delete('category');
    setSearchParams(next);
  };

  return (
    <>
      {/* ── page header ── */}
      <div className="border-b border-border bg-paper">
        <div className="container py-12 lg:py-16">
          <Reveal>
            <p className="eyebrow">{session ? `Table ${session.table.label} · ${session.cafe.name}` : 'The menu'}</p>
            <h1 className="mt-4 text-display-md text-foreground text-balance">
              {session ? 'What can we get started for you?' : (current?.name ?? 'Everything we make')}
            </h1>
            <p className="mt-4 max-w-2xl font-sans text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
              {current?.description ??
                'Coffee roasted in-house, bread and pasta made each morning, and a kitchen that would rather run out than cut corners.'}
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <Button variant="outline" size="sm" onClick={openSearch} className="mt-7">
              <Search className="h-3.5 w-3.5" />
              Search the menu
              <kbd className="ml-1.5 hidden rounded border border-espresso/20 px-1.5 py-px font-sans text-[0.625rem] text-muted-foreground sm:inline">
                ⌘K
              </kbd>
            </Button>
          </Reveal>
        </div>
      </div>

      {/* ── category rail ── */}
      <div className="sticky top-16 z-30 border-b border-border bg-cream/[0.92] backdrop-blur-md">
        <div className="container">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-3">
            <button
              type="button"
              onClick={() => selectCategory(undefined)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 font-sans text-[0.8125rem] font-medium transition-colors',
                !activeCategory ? 'bg-espresso text-cream' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              All
            </button>
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/menu/${category.slug}`}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 font-sans text-[0.8125rem] font-medium transition-colors',
                  activeCategory === category.slug
                    ? 'bg-espresso text-cream'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {category.name}
                <span className="ml-1.5 text-[0.6875rem] opacity-55">{category.productCount}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── grid ── */}
      <div className="container py-10">
        <div className="flex gap-10">
          <FilterSidebar filters={filters} onChange={setFilters} />

          <div className="min-w-0 flex-1">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="font-sans text-sm text-muted-foreground" aria-live="polite">
                {isLoading ? 'Loading…' : pluralise(total, 'dish', 'dishes')}
                {isFetching && !isLoading && <span className="ml-2 opacity-60">updating…</span>}
              </p>
              <div className="flex items-center gap-2.5">
                <MobileFilterButton filters={filters} onChange={setFilters} resultCount={total} />
                <SortSelect value={filters.sort} onChange={(sort) => setFilters({ ...filters, sort })} />
              </div>
            </div>

            <ActiveFilterChips filters={filters} onChange={setFilters} />

            {isError && (
              <ErrorState
                title="Unable to load the menu"
                message={error instanceof Error ? error.message : undefined}
                onRetry={() => void refetch()}
              />
            )}

            {isLoading && <ProductGridSkeleton count={9} />}

            {!isLoading && !isError && products.length === 0 && (
              <EmptyState
                icon={UtensilsCrossed}
                title="Nothing matches those filters"
                description="Try widening the price range or clearing a filter or two."
                action={{ label: 'Clear filters', onClick: () => setFilters(DEFAULT_FILTERS) }}
              />
            )}

            {products.length > 0 && (
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} onOpen={setOpenSlug} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ProductModal slug={openSlug} open={Boolean(openSlug)} onOpenChange={(open) => !open && setOpenSlug(null)} />
    </>
  );
}
