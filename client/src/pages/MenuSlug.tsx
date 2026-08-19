import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { menuApi } from '@/api/endpoints';
import Menu from './Menu';
import ProductPage from './ProductPage';

/**
 * `/menu/:slug` serves two kinds of page, so both `/menu/coffee` and
 * `/menu/truffle-mushroom-pasta` stay clean, readable URLs. The category list is
 * cached app-wide, so this resolution is usually instant and costs no request.
 */
export default function MenuSlug() {
  const { slug } = useParams<{ slug: string }>();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => menuApi.categories().then((response) => response.categories),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[60svh] place-items-center" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isCategory = categories?.some((category) => category.slug === slug);

  return isCategory ? <Menu categorySlug={slug} /> : <ProductPage slug={slug!} />;
}
