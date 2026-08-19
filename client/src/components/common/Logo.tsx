import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * The ALAAP wordmark. An *alaap* is the slow, unmetered opening of a raga — the
 * two dots stand in for that unhurried first breath before the rhythm starts.
 */
export function Logo({
  className,
  tone = 'dark',
  showTagline = false,
  asLink = true,
}: {
  className?: string;
  tone?: 'dark' | 'light';
  showTagline?: boolean;
  asLink?: boolean;
}) {
  const content = (
    <span className={cn('inline-flex flex-col leading-none', className)}>
      <span className="inline-flex items-center gap-[0.3em]">
        <span
          className={cn(
            'font-display text-[1.375rem] font-medium tracking-[0.14em] sm:text-[1.5rem]',
            tone === 'light' ? 'text-cream' : 'text-espresso',
          )}
          style={{ fontVariationSettings: "'SOFT' 30, 'WONK' 0, 'opsz' 40" }}
        >
          ALAAP
        </span>
        <span aria-hidden className="mb-1.5 inline-flex gap-[0.2em]">
          <span className={cn('h-[3px] w-[3px] rounded-full', tone === 'light' ? 'bg-cream/60' : 'bg-terracotta')} />
          <span className={cn('h-[3px] w-[3px] rounded-full', tone === 'light' ? 'bg-cream/35' : 'bg-terracotta/45')} />
        </span>
      </span>
      {showTagline && (
        <span
          className={cn(
            'mt-1 text-[0.5rem] font-medium uppercase tracking-[0.28em]',
            tone === 'light' ? 'text-cream/55' : 'text-muted-foreground',
          )}
        >
          Coffee Roasters &amp; Kitchen
        </span>
      )}
    </span>
  );

  if (!asLink) return content;

  return (
    <Link to="/" aria-label="ALAAP — home" className="inline-block">
      {content}
    </Link>
  );
}
