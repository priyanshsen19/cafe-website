import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

/** Everything needed to price and customise a product in one round trip. */
export const productDetailInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: 'asc' } },
  modifiers: {
    orderBy: { sortOrder: 'asc' },
    include: {
      modifier: {
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export type ProductDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

export const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  basePrice: true,
  imageUrl: true,
  calories: true,
  prepTimeMinutes: true,
  tags: true,
  isVegetarian: true,
  isVegan: true,
  containsEgg: true,
  containsNuts: true,
  containsGluten: true,
  isSpicy: true,
  isBestseller: true,
  isNew: true,
  isChefSpecial: true,
  isSeasonal: true,
  isAvailable: true,
  ratingAvg: true,
  ratingCount: true,
  orderCount: true,
  sortOrder: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { modifiers: true } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export function findBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug }, include: productDetailInclude });
}

export function findById(id: string) {
  return prisma.product.findUnique({ where: { id }, include: productDetailInclude });
}

export function findManyByIds(ids: string[]) {
  return prisma.product.findMany({ where: { id: { in: ids } }, include: productDetailInclude });
}

/** Flattens the join table into the shape the pricing engine expects. */
export function toModifierGroups(product: ProductDetail) {
  return product.modifiers.map((link) => ({
    id: link.modifier.id,
    name: link.modifier.name,
    description: link.modifier.description,
    selectionType: link.modifier.selectionType,
    isRequired: link.modifier.isRequired,
    minSelect: link.modifier.minSelect,
    maxSelect: link.modifier.maxSelect,
    sortOrder: link.sortOrder,
    options: link.modifier.options.map((option) => ({
      id: option.id,
      name: option.name,
      priceDelta: option.priceDelta,
      isDefault: option.isDefault,
      isAvailable: option.isAvailable,
    })),
  }));
}
