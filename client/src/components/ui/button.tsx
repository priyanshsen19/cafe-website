import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-sm font-medium transition-all duration-200 ease-editorial disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 select-none',
  {
    variants: {
      variant: {
        // Espresso fill — the standard commitment action.
        default: 'bg-primary text-primary-foreground hover:bg-charcoal active:scale-[0.985] shadow-subtle',
        // Terracotta — reserved for the single most important CTA on a view.
        accent: 'bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.985] shadow-subtle',
        outline: 'border border-espresso/25 bg-transparent text-foreground hover:border-espresso hover:bg-espresso/[0.04]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-sand',
        ghost: 'text-foreground hover:bg-espresso/[0.05]',
        link: 'text-foreground underline-offset-4 hover:underline',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-9 rounded-md px-3.5 text-[0.8125rem]',
        default: 'h-11 rounded-md px-5',
        lg: 'h-[3.25rem] rounded-md px-7 text-[0.9375rem]',
        icon: 'h-10 w-10 rounded-md',
        'icon-sm': 'h-8 w-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and blocks interaction, for in-flight mutations. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    // `asChild` forwards a single child, so a spinner can't be injected there.
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
