import { useEffect, useLayoutEffect, useState } from 'react';

/** Delays a fast-changing value — used for search-as-you-type. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', listener);
    return () => list.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/** Tracks how far the page has scrolled past a threshold, for the sticky header. */
export function useScrolled(threshold = 12): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrolled;
}

/**
 * Sets the document title and meta description per route. A hand-rolled hook is
 * enough here and avoids pulling in a head-management dependency.
 */
export function useSeo(input: { title: string; description?: string; canonicalPath?: string }) {
  useLayoutEffect(() => {
    const previous = document.title;
    document.title = input.title.includes('ALAAP') ? input.title : `${input.title} · ALAAP`;

    const setMeta = (selector: string, attribute: string, value: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(selector);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute.startsWith('og:') ? 'property' : 'name', attribute);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', value);
    };

    if (input.description) {
      setMeta('meta[name="description"]', 'description', input.description);
      setMeta('meta[property="og:description"]', 'og:description', input.description);
    }
    setMeta('meta[property="og:title"]', 'og:title', document.title);

    if (input.canonicalPath) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = `https://alaap.coffee${input.canonicalPath}`;
    }

    return () => {
      document.title = previous;
    };
  }, [input.title, input.description, input.canonicalPath]);
}

/** Counts up from now, so the kitchen board's order ages stay live. */
export function useTicker(intervalMs = 30_000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return tick;
}
