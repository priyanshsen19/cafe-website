import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Star rating. Renders half-steps by clipping a filled row over an empty one,
 * which keeps sub-pixel alignment exact at any size.
 */
export function Rating({
  value,
  count,
  size = 'default',
  showValue = false,
  className,
}: {
  value: number;
  count?: number;
  size?: 'sm' | 'default' | 'lg';
  showValue?: boolean;
  className?: string;
}) {
  const dimension = { sm: 'h-3 w-3', default: 'h-3.5 w-3.5', lg: 'h-4 w-4' }[size];
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className="relative inline-flex"
        role="img"
        aria-label={`Rated ${value.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ''}`}
      >
        <span className="flex gap-px">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} className={cn(dimension, 'text-espresso/[0.18]')} fill="currentColor" strokeWidth={0} />
          ))}
        </span>
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${percent}%` }} aria-hidden>
          <span className="flex gap-px">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className={cn(dimension, 'text-terracotta')} fill="currentColor" strokeWidth={0} />
            ))}
          </span>
        </span>
      </span>

      {showValue && value > 0 && (
        <span className={cn('font-sans tabular-nums text-foreground', size === 'sm' ? 'text-[0.6875rem]' : 'text-xs')}>
          {value.toFixed(1)}
        </span>
      )}
      {count !== undefined && count > 0 && (
        <span className={cn('font-sans text-muted-foreground', size === 'sm' ? 'text-[0.6875rem]' : 'text-xs')}>
          ({count})
        </span>
      )}
    </div>
  );
}

/** Interactive star picker for the review form. */
export function RatingInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1', className)} role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
          onClick={() => onChange(star)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={cn('h-6 w-6 transition-colors', star <= value ? 'text-terracotta' : 'text-espresso/20')}
            fill="currentColor"
            strokeWidth={0}
          />
        </button>
      ))}
    </div>
  );
}
