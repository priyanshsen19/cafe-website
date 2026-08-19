import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Empty states are written as invitations rather than dead ends — every one has
 * a next step and copy that sounds like the café, not the database.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; to?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      {Icon && (
        <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
        </span>
      )}
      <h3 className="font-display text-2xl text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm font-sans text-sm leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          {action.to ? (
            <Button asChild>
              <Link to={action.to}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Failure state. Shows the API's customer-safe message — internal details never
 * reach here, because the server maps unknown faults to a generic message.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h3 className="font-display text-2xl text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm font-sans text-sm leading-relaxed text-muted-foreground text-pretty">
        {message ?? 'Please try again in a moment.'}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-6">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

/** Inline variant for a failed section inside an otherwise working page. */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/[0.04] px-4 py-3"
    >
      <p className="font-sans text-sm text-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
