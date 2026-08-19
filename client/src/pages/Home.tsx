import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { menuApi } from '@/api/endpoints';
import { useSeo } from '@/hooks/useUtils';
import { Hero } from '@/components/home/Hero';
import { CollectionSection, OrderModesSection, StorySection, VisitSection } from '@/components/home/Sections';
import { ProductModal } from '@/components/menu/ProductModal';
import { InlineError } from '@/components/common/States';

export default function Home() {
  useSeo({
    title: 'ALAAP — Coffee Roasters & Kitchen',
    description:
      'Specialty coffee, all-day breakfast and a small kitchen in Bengaluru, Mumbai and Hyderabad. Order for delivery, collect from the counter, or scan your table.',
    canonicalPath: '/',
  });

  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['collections'],
    queryFn: () => menuApi.collections().then((response) => response.collections),
    staleTime: 5 * 60 * 1000,
  });

  const collections = data;

  return (
    <>
      <Hero />

      {isError && (
        <div className="container py-12">
          <InlineError
            message={error instanceof Error ? error.message : 'Unable to load the menu.'}
            onRetry={() => void refetch()}
          />
        </div>
      )}

      <CollectionSection
        eyebrow="From the bar"
        title="Signature coffee"
        description="Espresso pulled slightly under nine bars, milk textured to sixty-two degrees. The classics, done properly."
        products={collections?.signatureCoffee ?? []}
        to="/menu/coffee"
        isLoading={isLoading}
        columns={4}
        onOpenProduct={setOpenSlug}
      />

      <CollectionSection
        eyebrow="Until four in the afternoon"
        title="Breakfast"
        description="Because mornings should be allowed to run late."
        products={collections?.breakfast ?? []}
        to="/menu/breakfast"
        isLoading={isLoading}
        columns={4}
        className="bg-paper"
        onOpenProduct={setOpenSlug}
      />

      <StorySection />

      <CollectionSection
        eyebrow="Only here"
        title="Seasonal specials"
        description="Small runs we make while the ingredients are at their best. When they’re gone, they’re gone."
        products={collections?.seasonal ?? []}
        to="/menu/signature"
        isLoading={isLoading}
        columns={4}
        onOpenProduct={setOpenSlug}
      />

      <CollectionSection
        eyebrow="Lunch onwards"
        title="All-day favourites"
        description="Pasta rolled this morning, bread baked this morning, dressed at the last second."
        products={collections?.allDay ?? []}
        to="/menu/pasta"
        isLoading={isLoading}
        columns={4}
        className="bg-paper"
        onOpenProduct={setOpenSlug}
      />

      <OrderModesSection />

      <CollectionSection
        eyebrow="Save room"
        title="Desserts"
        description="Made in small trays each morning, and finished by evening."
        products={collections?.desserts ?? []}
        to="/menu/desserts"
        isLoading={isLoading}
        columns={4}
        className="bg-paper"
        onOpenProduct={setOpenSlug}
      />

      <VisitSection />

      <ProductModal slug={openSlug} open={Boolean(openSlug)} onOpenChange={(open) => !open && setOpenSlug(null)} />
    </>
  );
}
