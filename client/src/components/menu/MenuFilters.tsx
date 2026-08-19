import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Slider } from '@/components/ui/form-controls';
import { cn, formatINR } from '@/lib/utils';
import type { ProductFilters } from '@/api/endpoints';

export const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'newest', label: 'Newest' },
] as const;

const TOGGLES = [
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'spicy', label: 'Spicy' },
  { key: 'bestseller', label: 'Bestsellers' },
  { key: 'isNew', label: 'New' },
  { key: 'available', label: 'Available now' },
] as const;

export const PRICE_BOUNDS = [150, 600] as const;

export interface FilterState {
  vegetarian: boolean;
  vegan: boolean;
  spicy: boolean;
  bestseller: boolean;
  isNew: boolean;
  available: boolean;
  minRating: number;
  price: [number, number];
  sort: ProductFilters['sort'];
}

export const DEFAULT_FILTERS: FilterState = {
  vegetarian: false,
  vegan: false,
  spicy: false,
  bestseller: false,
  isNew: false,
  available: false,
  minRating: 0,
  price: [PRICE_BOUNDS[0], PRICE_BOUNDS[1]],
  sort: 'recommended',
};

export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  for (const toggle of TOGGLES) if (filters[toggle.key]) count += 1;
  if (filters.minRating > 0) count += 1;
  if (filters.price[0] !== PRICE_BOUNDS[0] || filters.price[1] !== PRICE_BOUNDS[1]) count += 1;
  return count;
}

/** Shared control body, rendered inline on desktop and inside a sheet on mobile. */
function FilterBody({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
}) {
  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 font-sans text-[0.8125rem] font-medium text-foreground">Dietary &amp; badges</legend>
        <div className="space-y-2.5">
          {TOGGLES.map((toggle) => (
            <label key={toggle.key} className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={filters[toggle.key]}
                onCheckedChange={(checked) => onChange({ ...filters, [toggle.key]: checked === true })}
              />
              <span className="font-sans text-sm text-foreground">{toggle.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Separator />

      <fieldset>
        <legend className="mb-1 font-sans text-[0.8125rem] font-medium text-foreground">Price</legend>
        <p className="mb-4 font-sans text-xs tabular-nums text-muted-foreground">
          {formatINR(filters.price[0])} – {formatINR(filters.price[1])}
          {filters.price[1] === PRICE_BOUNDS[1] && '+'}
        </p>
        <Slider
          value={filters.price}
          min={PRICE_BOUNDS[0]}
          max={PRICE_BOUNDS[1]}
          step={10}
          minStepsBetweenThumbs={1}
          onValueChange={(value) => onChange({ ...filters, price: [value[0]!, value[1]!] })}
        />
      </fieldset>

      <Separator />

      <fieldset>
        <legend className="mb-3 font-sans text-[0.8125rem] font-medium text-foreground">Minimum rating</legend>
        <div className="flex flex-wrap gap-2">
          {[0, 4, 4.5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange({ ...filters, minRating: rating })}
              aria-pressed={filters.minRating === rating}
              className={cn(
                'rounded-full border px-3.5 py-1.5 font-sans text-xs transition-colors',
                filters.minRating === rating
                  ? 'border-espresso bg-espresso text-cream'
                  : 'border-border text-foreground hover:border-espresso/40',
              )}
            >
              {rating === 0 ? 'Any' : `${rating}★ & up`}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Desktop: a persistent sidebar that stays with the grid as it scrolls. */
export function FilterSidebar({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const activeCount = countActiveFilters(filters);

  return (
    <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filter the menu">
      <div className="sticky top-32">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg text-foreground">Filter</h2>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
              className="font-sans text-xs text-accent hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        <FilterBody filters={filters} onChange={onChange} />
      </div>
    </aside>
  );
}

/** Mobile: the same controls in a bottom sheet, triggered from the toolbar. */
export function MobileFilterButton({
  filters,
  onChange,
  resultCount,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  resultCount: number;
}) {
  const activeCount = countActiveFilters(filters);

  return (
    <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="lg:hidden">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            {activeCount > 0 && (
              <Badge variant="accent" size="sm" className="ml-0.5">
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh]">
          <SheetHeader>
            <SheetTitle>Filter</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <FilterBody filters={filters} onChange={onChange} />
          </div>
          <SheetFooter className="flex-row gap-2.5">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
            >
              Clear
            </Button>
            <SheetClose asChild>
              <Button className="flex-1">
                Show {resultCount} {resultCount === 1 ? 'dish' : 'dishes'}
              </Button>
            </SheetClose>
          </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Sort control, shown beside the result count on every breakpoint. */
export function SortSelect({
  value,
  onChange,
}: {
  value: ProductFilters['sort'];
  onChange: (next: ProductFilters['sort']) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ProductFilters['sort'])}>
      <SelectTrigger className="h-9 w-auto min-w-[11rem] gap-2 text-[0.8125rem]" aria-label="Sort dishes">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Removable chips summarising what's currently narrowing the list. */
export function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const chips: { label: string; clear: () => void }[] = [];

  for (const toggle of TOGGLES) {
    if (filters[toggle.key]) {
      chips.push({ label: toggle.label, clear: () => onChange({ ...filters, [toggle.key]: false }) });
    }
  }
  if (filters.minRating > 0) {
    chips.push({ label: `${filters.minRating}★ & up`, clear: () => onChange({ ...filters, minRating: 0 }) });
  }
  if (filters.price[0] !== PRICE_BOUNDS[0] || filters.price[1] !== PRICE_BOUNDS[1]) {
    chips.push({
      label: `${formatINR(filters.price[0])}–${formatINR(filters.price[1])}`,
      clear: () => onChange({ ...filters, price: [PRICE_BOUNDS[0], PRICE_BOUNDS[1]] }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.label}>
          <button
            type="button"
            onClick={chip.clear}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-sans text-xs text-foreground transition-colors hover:border-espresso/40"
          >
            {chip.label}
            <X className="h-3 w-3 text-muted-foreground" aria-hidden />
            <span className="sr-only">Remove filter</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
