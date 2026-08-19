import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSeo } from '@/hooks/useUtils';

export default function NotFound() {
  useSeo({ title: 'Page not found' });

  return (
    <div className="container flex min-h-[70svh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-5 text-display-md text-foreground text-balance">
        This page isn’t on the menu.
      </h1>
      <p className="mt-4 max-w-md font-sans text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
        The link may be old, or we may have moved something. Everything we actually make is one tap away.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/menu">Explore the menu</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
