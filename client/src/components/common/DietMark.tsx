import { Egg, Flame, Leaf, Nut, Sparkles, Star, Wheat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

/**
 * The Indian veg / non-veg mark: a bordered square holding a filled dot for
 * vegetarian, a filled triangle for non-vegetarian. It's the first thing many
 * customers look for, so it sits on every card and every detail view.
 */
export function VegMark({ isVegetarian, className }: { isVegetarian: boolean; className?: string }) {
  const colour = isVegetarian ? 'text-olive' : 'text-destructive';
  const label = isVegetarian ? 'Vegetarian' : 'Non-vegetarian';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          className={cn(
            'grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-[3px] border-[1.5px] bg-card',
            isVegetarian ? 'border-olive' : 'border-destructive',
            className,
          )}
        >
          {isVegetarian ? (
            <span className={cn('h-2 w-2 rounded-full bg-current', colour)} />
          ) : (
            <svg viewBox="0 0 10 9" className={cn('h-2.5 w-2.5 fill-current', colour)} aria-hidden>
              <path d="M5 0l5 9H0z" />
            </svg>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

type LabelKey = 'vegan' | 'egg' | 'nuts' | 'gluten' | 'spicy' | 'bestseller' | 'new' | 'chef';

const LABELS: Record<LabelKey, { text: string; icon: typeof Leaf; description: string }> = {
  vegan: { text: 'Vegan', icon: Leaf, description: 'Made without any animal products' },
  egg: { text: 'Egg', icon: Egg, description: 'Contains egg' },
  nuts: { text: 'Nuts', icon: Nut, description: 'Contains nuts' },
  gluten: { text: 'Gluten', icon: Wheat, description: 'Contains gluten' },
  spicy: { text: 'Spicy', icon: Flame, description: 'Made with chilli heat' },
  bestseller: { text: 'Bestseller', icon: Star, description: 'One of our most-ordered dishes' },
  new: { text: 'New', icon: Sparkles, description: 'Recently added to the menu' },
  chef: { text: 'Chef’s Special', icon: Sparkles, description: 'Chosen by our kitchen' },
};

export function FoodLabel({ label, className }: { label: LabelKey; className?: string }) {
  const { text, icon: Icon, description } = LABELS[label];
  const variant = label === 'bestseller' || label === 'chef' ? 'accent' : label === 'vegan' ? 'olive' : 'muted';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} size="sm" className={cn('gap-1', className)}>
          <Icon className="h-2.5 w-2.5" aria-hidden />
          {text}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}

/** The dietary and allergen row shown under a dish name. */
export function DietaryLabels({
  product,
  className,
  limit,
}: {
  product: Pick<Product, 'isVegan' | 'containsEgg' | 'containsNuts' | 'containsGluten' | 'isSpicy' | 'isChefSpecial'>;
  className?: string;
  limit?: number;
}) {
  const labels: LabelKey[] = [];
  if (product.isVegan) labels.push('vegan');
  if (product.isSpicy) labels.push('spicy');
  if (product.containsEgg) labels.push('egg');
  if (product.containsNuts) labels.push('nuts');
  if (product.containsGluten) labels.push('gluten');

  const shown = limit ? labels.slice(0, limit) : labels;
  if (shown.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {shown.map((label) => (
        <FoodLabel key={label} label={label} />
      ))}
      {limit && labels.length > limit && (
        <span className="text-[0.625rem] text-muted-foreground">+{labels.length - limit}</span>
      )}
    </div>
  );
}
