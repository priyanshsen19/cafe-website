import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border font-sans transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-espresso text-cream',
        outline: 'border-espresso/20 bg-transparent text-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        accent: 'border-transparent bg-accent text-accent-foreground',
        olive: 'border-transparent bg-olive/[0.12] text-olive',
        paper: 'border-border bg-card text-foreground',
        // Sold-out and error states.
        subtle: 'border-transparent bg-espresso/[0.06] text-muted-foreground',
      },
      size: {
        default: 'px-2.5 py-0.5 text-[0.6875rem] font-medium tracking-wide',
        sm: 'px-2 py-px text-[0.625rem] font-medium tracking-wide',
        lg: 'px-3 py-1 text-xs font-medium',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Forwards its ref so Radix primitives (Tooltip/Popover triggers using
 * `asChild`) can anchor to it.
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, size, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />
));
Badge.displayName = 'Badge';

export { Badge };

export { badgeVariants };
