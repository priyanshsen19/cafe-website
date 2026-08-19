import { z } from 'zod';

const boolish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

export const listProductsSchema = z.object({
  category: z.string().trim().min(1).optional(),
  q: z.string().trim().max(80).optional(),
  vegetarian: boolish.optional(),
  vegan: boolish.optional(),
  spicy: boolish.optional(),
  bestseller: boolish.optional(),
  isNew: boolish.optional(),
  available: boolish.optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z
    .enum(['recommended', 'popular', 'price-asc', 'price-desc', 'rating', 'newest'])
    .default('recommended'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(60),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1, 'Type something to search').max(80),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export type ListProductsQuery = z.infer<typeof listProductsSchema>;
