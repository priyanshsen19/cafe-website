import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Renders the error styling and wires aria-invalid for assistive tech. */
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', invalid, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-11 w-full rounded-md border bg-card px-3.5 py-2 font-sans text-[0.9375rem] text-foreground transition-colors',
        'placeholder:text-muted-foreground/70',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
        invalid ? 'border-destructive focus-visible:ring-destructive' : 'border-input hover:border-espresso/30',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex min-h-[5.5rem] w-full rounded-md border bg-card px-3.5 py-2.5 font-sans text-[0.9375rem] text-foreground transition-colors',
        'placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-destructive focus-visible:ring-destructive' : 'border-input hover:border-espresso/30',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Input, Textarea };
