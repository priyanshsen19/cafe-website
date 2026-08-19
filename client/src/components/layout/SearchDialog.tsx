import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, CornerDownLeft, Loader2, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VegMark } from '@/components/common/DietMark';
import { menuApi } from '@/api/endpoints';
import { useDebounced } from '@/hooks/useUtils';
import { addRecentSearch, clearRecentSearches, getRecentSearches, useUiStore } from '@/store/ui';
import { cn, formatINR } from '@/lib/utils';

const SUGGESTIONS = ['Flat white', 'Cold brew', 'Truffle pasta', 'Matcha', 'Avocado toast', 'Cheesecake'];

/**
 * Global menu search. Results are keyboard navigable — ↑/↓ to move, Enter to
 * open, Escape to dismiss — and searching spans dish names, descriptions,
 * categories, ingredients and tags on the server.
 */
export function SearchDialog() {
  const isOpen = useUiStore((state) => state.isSearchOpen);
  const setSearchOpen = useUiStore((state) => state.setSearchOpen);

  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const debounced = useDebounced(term.trim(), 220);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => menuApi.search(debounced, 8),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const results = data?.items ?? [];

  useEffect(() => {
    if (isOpen) {
      setRecent(getRecentSearches());
      setActiveIndex(0);
    } else {
      setTerm('');
    }
  }, [isOpen]);

  useEffect(() => setActiveIndex(0), [debounced]);

  // ⌘K / Ctrl+K opens search from anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        useUiStore.getState().openSearch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (slug: string, label: string) => {
    setRecent(addRecentSearch(label));
    setSearchOpen(false);
    navigate(`/menu/${slug}`);
  };

  const submit = () => {
    const trimmed = term.trim();
    if (!trimmed) return;

    const chosen = results[activeIndex];
    if (chosen) {
      go(chosen.slug, trimmed);
      return;
    }

    setRecent(addRecentSearch(trimmed));
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setSearchOpen}>
      <DialogContent size="lg" hideClose className="top-[12%] translate-y-0 p-0 sm:top-[14%]">
        <DialogTitle className="sr-only">Search the menu</DialogTitle>

        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Search className="h-[1.125rem] w-[1.125rem] shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search coffee, breakfast, pasta…"
            aria-label="Search the menu"
            aria-controls="search-results"
            autoComplete="off"
            className="flex-1 bg-transparent font-sans text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                inputRef.current?.focus();
              }}
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-secondary"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-[min(26rem,55dvh)] overflow-y-auto p-2" id="search-results" role="listbox">
          {/* ── idle: recent + suggestions ── */}
          {debounced.length < 2 && (
            <div className="p-2">
              {recent.length > 0 && (
                <>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="eyebrow">Recent</p>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentSearches();
                        setRecent([]);
                      }}
                      className="font-sans text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="mb-5 space-y-0.5">
                    {recent.map((entry) => (
                      <li key={entry}>
                        <button
                          type="button"
                          onClick={() => setTerm(entry)}
                          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left font-sans text-sm text-foreground transition-colors hover:bg-secondary"
                        >
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          {entry}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <p className="eyebrow mb-2.5 px-1">Try</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setTerm(suggestion)}
                    className="rounded-full border border-border px-3 py-1.5 font-sans text-xs text-foreground transition-colors hover:border-espresso hover:bg-secondary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── results ── */}
          {debounced.length >= 2 && results.length === 0 && !isFetching && (
            <div className="px-4 py-10 text-center">
              <p className="font-display text-lg text-foreground">Nothing matched “{debounced}”.</p>
              <p className="mt-1.5 font-sans text-sm text-muted-foreground">
                Try a dish name, an ingredient, or a category.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <ul className="space-y-0.5">
              {results.map((product, index) => (
                <li key={product.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(product.slug, term.trim())}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors',
                      index === activeIndex ? 'bg-secondary' : 'hover:bg-secondary/60',
                    )}
                  >
                    <div className="media h-11 w-11 shrink-0 rounded-md">
                      <img src={product.imageUrl} alt="" width={88} height={88} loading="lazy" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <VegMark isVegetarian={product.isVegetarian} className="h-3.5 w-3.5" />
                        <p className="truncate font-sans text-sm font-medium text-foreground">{product.name}</p>
                        {!product.isAvailable && (
                          <span className="shrink-0 font-sans text-[0.625rem] text-muted-foreground">· sold out</span>
                        )}
                      </div>
                      <p className="truncate font-sans text-xs text-muted-foreground">{product.category.name}</p>
                    </div>
                    <span className="shrink-0 font-sans text-sm tabular-nums text-foreground">
                      {formatINR(product.basePrice)}
                    </span>
                    {index === activeIndex && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {debounced.length >= 2 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <p className="font-sans text-[0.6875rem] text-muted-foreground">
              <kbd className="font-sans">↑↓</kbd> to navigate · <kbd className="font-sans">↵</kbd> to open
            </p>
            <button
              type="button"
              onClick={() => {
                setRecent(addRecentSearch(debounced));
                setSearchOpen(false);
                navigate(`/search?q=${encodeURIComponent(debounced)}`);
              }}
              className="font-sans text-xs font-medium text-accent hover:underline"
            >
              See all results
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
