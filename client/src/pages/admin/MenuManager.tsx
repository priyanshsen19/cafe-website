import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, FieldHint, Label } from '@/components/ui/label';
import { Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { VegMark } from '@/components/common/DietMark';
import { adminApi, menuApi } from '@/api/endpoints';
import { useDebounced, useSeo } from '@/hooks/useUtils';
import { formatINR } from '@/lib/utils';
import type { AdminProduct } from '@/types';

const productSchema = z.object({
  categoryId: z.string().min(1, 'Choose a category'),
  name: z.string().trim().min(2, 'Enter a name').max(90),
  description: z.string().trim().min(10, 'Add a short description').max(400),
  story: z.string().trim().max(1200).optional(),
  basePrice: z.coerce.number().int().min(1, 'Enter a price').max(100000),
  imageUrl: z.string().trim().url('Enter a valid image URL'),
  calories: z.coerce.number().int().min(0).max(5000).optional(),
  prepTimeMinutes: z.coerce.number().int().min(1).max(180).optional(),
  ingredientsText: z.string().trim().max(600).optional(),
  allergensText: z.string().trim().max(400).optional(),
  tagsText: z.string().trim().max(400).optional(),
  isVegetarian: z.boolean(),
  isVegan: z.boolean(),
  containsEgg: z.boolean(),
  containsNuts: z.boolean(),
  containsGluten: z.boolean(),
  isSpicy: z.boolean(),
  isBestseller: z.boolean(),
  isNew: z.boolean(),
  isChefSpecial: z.boolean(),
  isSeasonal: z.boolean(),
  isAvailable: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

const FLAGS = [
  { key: 'isVegetarian', label: 'Vegetarian' },
  { key: 'isVegan', label: 'Vegan' },
  { key: 'containsEgg', label: 'Contains egg' },
  { key: 'containsNuts', label: 'Contains nuts' },
  { key: 'containsGluten', label: 'Contains gluten' },
  { key: 'isSpicy', label: 'Spicy' },
] as const;

const BADGES = [
  { key: 'isBestseller', label: 'Bestseller' },
  { key: 'isNew', label: 'New' },
  { key: 'isChefSpecial', label: 'Chef’s special' },
  { key: 'isSeasonal', label: 'Seasonal' },
] as const;

/** Splits a comma-separated field into a trimmed list. */
function toList(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function AdminMenuManager() {
  useSeo({ title: 'Menu — Admin' });

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [isCreating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search.trim().toLowerCase(), 250);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => adminApi.products().then((response) => response.products),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => menuApi.categories().then((response) => response.categories),
  });

  const toggleAvailability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      adminApi.setAvailability(id, isAvailable),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(variables.isAvailable ? 'Back on the menu' : 'Marked unavailable');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteProduct(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(
        result.retired
          ? 'This dish appears in past orders, so it was retired rather than deleted'
          : 'Dish deleted',
      );
      setConfirmDelete(null);
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const products = useMemo(() => {
    let list = data ?? [];
    if (categoryFilter !== 'ALL') list = list.filter((product) => product.category.slug === categoryFilter);
    if (debouncedSearch) {
      list = list.filter(
        (product) =>
          product.name.toLowerCase().includes(debouncedSearch) ||
          product.description.toLowerCase().includes(debouncedSearch),
      );
    }
    return list;
  }, [data, categoryFilter, debouncedSearch]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-foreground">Menu</h1>
          <p className="mt-1.5 font-sans text-sm text-muted-foreground">
            {data ? `${data.length} dishes` : 'Loading…'} · toggle availability, edit prices, add new items
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Add dish
        </Button>
      </div>

      {/* ── filters ── */}
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[15rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dishes…"
            aria-label="Search dishes"
            className="h-10 pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-10 w-auto min-w-[12rem]" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {(categories ?? []).map((category) => (
              <SelectItem key={category.id} value={category.slug}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <ErrorState
          title="Unable to load the menu"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="mt-6 space-y-2.5">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <EmptyState
          title="No dishes match"
          description="Try a different search or category."
          className="mt-6 rounded-lg border border-border bg-card"
        />
      )}

      {products.length > 0 && (
        <ul className="mt-6 space-y-2.5">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="media h-14 w-14 shrink-0 rounded-md">
                <img src={product.imageUrl} alt="" width={112} height={112} loading="lazy" />
              </div>

              <div className="min-w-[12rem] flex-1">
                <div className="flex items-center gap-2">
                  <VegMark isVegetarian={product.isVegetarian} className="h-4 w-4" />
                  <p className="font-sans text-sm font-medium text-foreground">{product.name}</p>
                </div>
                <p className="mt-1 line-clamp-1 font-sans text-xs text-muted-foreground">{product.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge variant="muted" size="sm">
                    {product.category.name}
                  </Badge>
                  {product.isBestseller && (
                    <Badge variant="accent" size="sm">
                      Bestseller
                    </Badge>
                  )}
                  {product.isNew && (
                    <Badge variant="outline" size="sm">
                      New
                    </Badge>
                  )}
                  {product.isSeasonal && (
                    <Badge variant="outline" size="sm">
                      Seasonal
                    </Badge>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="font-display text-lg tabular-nums text-foreground">{formatINR(product.basePrice)}</p>
                <p className="font-sans text-[0.6875rem] text-muted-foreground">
                  {product.orderItemCount} ordered · {product.ratingCount} reviews
                </p>
              </div>

              <label className="flex shrink-0 items-center gap-2.5">
                <Switch
                  checked={product.isAvailable}
                  onCheckedChange={(checked) => toggleAvailability.mutate({ id: product.id, isAvailable: checked })}
                  aria-label={`${product.name} availability`}
                />
                <span className="font-sans text-xs text-muted-foreground">
                  {product.isAvailable ? 'Available' : 'Sold out'}
                </span>
              </label>

              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon-sm" variant="ghost" onClick={() => setEditing(product)} aria-label={`Edit ${product.name}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                {confirmDelete === product.id ? (
                  <span className="flex items-center gap-1.5">
                    <Button size="sm" variant="destructive" loading={remove.isPending} onClick={() => remove.mutate(product.id)}>
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmDelete(product.id)}
                    aria-label={`Delete ${product.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProductDialog
        open={isCreating || Boolean(editing)}
        product={editing ?? undefined}
        categories={(categories ?? []).map((category) => ({ id: category.id, name: category.name }))}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </div>
  );
}

function ProductDialog({
  open,
  product,
  categories,
  onOpenChange,
}: {
  open: boolean;
  product?: AdminProduct;
  categories: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(product);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    values: product
      ? {
          categoryId: product.categoryId,
          name: product.name,
          description: product.description,
          story: product.story ?? '',
          basePrice: product.basePrice,
          imageUrl: product.imageUrl,
          calories: product.calories ?? undefined,
          prepTimeMinutes: product.prepTimeMinutes,
          ingredientsText: product.ingredients.join(', '),
          allergensText: product.allergens.join(', '),
          tagsText: product.tags.join(', '),
          isVegetarian: product.isVegetarian,
          isVegan: product.isVegan,
          containsEgg: product.containsEgg,
          containsNuts: product.containsNuts,
          containsGluten: product.containsGluten,
          isSpicy: product.isSpicy,
          isBestseller: product.isBestseller,
          isNew: product.isNew,
          isChefSpecial: product.isChefSpecial,
          isSeasonal: product.isSeasonal,
          isAvailable: product.isAvailable,
        }
      : undefined,
    defaultValues: {
      isVegetarian: true,
      isVegan: false,
      containsEgg: false,
      containsNuts: false,
      containsGluten: false,
      isSpicy: false,
      isBestseller: false,
      isNew: true,
      isChefSpecial: false,
      isSeasonal: false,
      isAvailable: true,
      prepTimeMinutes: 10,
    },
  });

  const save = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const { ingredientsText, allergensText, tagsText, ...rest } = values;
      const payload = {
        ...rest,
        story: rest.story?.trim() || undefined,
        ingredients: toList(ingredientsText),
        allergens: toList(allergensText),
        tags: toList(tagsText),
      };

      return isEditing
        ? adminApi.updateProduct(product!.id, payload)
        : adminApi.createProduct(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast.success(isEditing ? 'Dish updated' : 'Dish added to the menu');
      reset();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const imageUrl = watch('imageUrl');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit ${product!.name}` : 'Add a dish'}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="min-h-0 flex-1 overflow-y-auto px-6 pb-2"
          noValidate
        >
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div>
                <Label htmlFor="m-name">Name</Label>
                <Input id="m-name" className="mt-1.5" invalid={Boolean(errors.name)} {...register('name')} />
                <FieldError>{errors.name?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="m-description">Description</Label>
                <Textarea
                  id="m-description"
                  className="mt-1.5"
                  rows={3}
                  invalid={Boolean(errors.description)}
                  {...register('description')}
                />
                <FieldError>{errors.description?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="m-story">Story (optional)</Label>
                <Textarea id="m-story" className="mt-1.5" rows={3} {...register('story')} />
                <FieldHint>The longer note shown on the dish page.</FieldHint>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="m-price">Price (₹)</Label>
                  <Input
                    id="m-price"
                    type="number"
                    inputMode="numeric"
                    className="mt-1.5"
                    invalid={Boolean(errors.basePrice)}
                    {...register('basePrice')}
                  />
                  <FieldError>{errors.basePrice?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="m-calories">Calories</Label>
                  <Input id="m-calories" type="number" inputMode="numeric" className="mt-1.5" {...register('calories')} />
                </div>
                <div>
                  <Label htmlFor="m-prep">Prep (min)</Label>
                  <Input id="m-prep" type="number" inputMode="numeric" className="mt-1.5" {...register('prepTimeMinutes')} />
                </div>
              </div>

              <div>
                <Label htmlFor="m-category">Category</Label>
                <Select value={watch('categoryId') ?? ''} onValueChange={(value) => setValue('categoryId', value)}>
                  <SelectTrigger id="m-category" className="mt-1.5">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError>{errors.categoryId?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="m-ingredients">Ingredients</Label>
                <Input
                  id="m-ingredients"
                  className="mt-1.5"
                  placeholder="tagliatelle, wild mushrooms, parmesan"
                  {...register('ingredientsText')}
                />
                <FieldHint>Comma separated. Used by search.</FieldHint>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="m-allergens">Allergens</Label>
                  <Input id="m-allergens" className="mt-1.5" placeholder="Gluten, Milk" {...register('allergensText')} />
                </div>
                <div>
                  <Label htmlFor="m-tags">Tags</Label>
                  <Input id="m-tags" className="mt-1.5" placeholder="pasta, truffle, creamy" {...register('tagsText')} />
                </div>
              </div>
            </div>

            {/* ── image + flags ── */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="m-image">Image URL</Label>
                <Input id="m-image" className="mt-1.5" invalid={Boolean(errors.imageUrl)} {...register('imageUrl')} />
                <FieldError>{errors.imageUrl?.message}</FieldError>
                <div className="media mt-3 aspect-[4/3] rounded-md">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" />
                  ) : (
                    <div className="grid h-full place-items-center font-sans text-xs text-muted-foreground">
                      Image preview
                    </div>
                  )}
                </div>
              </div>

              <fieldset>
                <legend className="mb-2.5 font-sans text-[0.8125rem] font-medium text-foreground">Dietary</legend>
                <div className="space-y-2">
                  {FLAGS.map((flag) => (
                    <label key={flag.key} className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={watch(flag.key) ?? false}
                        onCheckedChange={(checked) => setValue(flag.key, checked === true)}
                      />
                      <span className="font-sans text-sm text-foreground">{flag.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2.5 font-sans text-[0.8125rem] font-medium text-foreground">Badges</legend>
                <div className="space-y-2">
                  {BADGES.map((badge) => (
                    <label key={badge.key} className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={watch(badge.key) ?? false}
                        onCheckedChange={(checked) => setValue(badge.key, checked === true)}
                      />
                      <span className="font-sans text-sm text-foreground">{badge.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border p-3">
                <Switch
                  checked={watch('isAvailable') ?? true}
                  onCheckedChange={(checked) => setValue('isAvailable', checked)}
                />
                <span className="font-sans text-sm text-foreground">Available to order</span>
              </label>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end gap-2.5 border-t border-border bg-card px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEditing ? 'Save changes' : 'Add to menu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
