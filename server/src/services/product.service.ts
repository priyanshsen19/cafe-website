import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import {
  productCardSelect,
  productDetailInclude,
  toModifierGroups,
} from '../repositories/product.repository';
import type { ListProductsQuery } from '../validators/product.validator';

function orderByFor(sort: ListProductsQuery['sort']): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'popular':
      return [{ orderCount: 'desc' }, { ratingAvg: 'desc' }];
    case 'price-asc':
      return [{ basePrice: 'asc' }];
    case 'price-desc':
      return [{ basePrice: 'desc' }];
    case 'rating':
      return [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }];
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'recommended':
    default:
      // Curated feel: available first, then the café's own ordering.
      return [{ isAvailable: 'desc' }, { sortOrder: 'asc' }, { orderCount: 'desc' }];
  }
}

export async function listProducts(query: ListProductsQuery) {
  const where: Prisma.ProductWhereInput = {};
  const and: Prisma.ProductWhereInput[] = [];

  if (query.category) where.category = { slug: query.category };
  if (query.vegetarian) where.isVegetarian = true;
  if (query.vegan) where.isVegan = true;
  if (query.spicy) where.isSpicy = true;
  if (query.bestseller) where.isBestseller = true;
  if (query.isNew) where.isNew = true;
  if (query.available) where.isAvailable = true;
  if (query.minRating !== undefined) where.ratingAvg = { gte: query.minRating };

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.basePrice = {
      ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
    };
  }

  if (query.q) {
    and.push(buildSearchWhere(query.q));
  }

  if (and.length) where.AND = and;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: productCardSelect,
      orderBy: orderByFor(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

/**
 * Search spans name, description, category, ingredients and tags — so "coffee"
 * finds the cappuccino via its category and "truffle" finds the pasta via its
 * ingredient list.
 */
function buildSearchWhere(term: string): Prisma.ProductWhereInput {
  const words = term.split(/\s+/).filter(Boolean).slice(0, 5);

  return {
    AND: words.map((word) => ({
      OR: [
        { name: { contains: word, mode: 'insensitive' } },
        { description: { contains: word, mode: 'insensitive' } },
        { story: { contains: word, mode: 'insensitive' } },
        { category: { name: { contains: word, mode: 'insensitive' } } },
        { tags: { has: word.toLowerCase() } },
        { ingredients: { has: word.toLowerCase() } },
        { tags: { hasSome: [word, word.toLowerCase(), word.toUpperCase()] } },
      ],
    })),
  };
}

export async function searchProducts(term: string, limit: number) {
  const items = await prisma.product.findMany({
    where: { AND: [buildSearchWhere(term)] },
    select: productCardSelect,
    orderBy: [{ isAvailable: 'desc' }, { orderCount: 'desc' }, { ratingAvg: 'desc' }],
    take: limit,
  });

  const categories = await prisma.category.findMany({
    where: { name: { contains: term, mode: 'insensitive' }, isActive: true },
    select: { id: true, name: true, slug: true },
    take: 3,
  });

  return { items, categories };
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug }, include: productDetailInclude });
  if (!product) throw AppError.notFound('We couldn’t find that dish.', 'PRODUCT_NOT_FOUND');

  const reviews = await prisma.review.findMany({
    where: { productId: product.id },
    orderBy: [{ isVerified: 'desc' }, { createdAt: 'desc' }],
    take: 8,
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      isVerified: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });

  const related = await prisma.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id }, isAvailable: true },
    select: productCardSelect,
    orderBy: { orderCount: 'desc' },
    take: 4,
  });

  const { modifiers: _joinRows, ...rest } = product;

  return {
    ...rest,
    modifierGroups: toModifierGroups(product),
    reviews,
    related,
  };
}

export async function listCategories() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return categories.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
}

/** Curated groupings the homepage renders as editorial sections. */
export async function getHomeCollections() {
  const [signatureCoffee, breakfast, allDay, desserts, seasonal, bestsellers] = await Promise.all([
    prisma.product.findMany({
      where: { category: { slug: 'coffee' }, isAvailable: true },
      select: productCardSelect,
      orderBy: { sortOrder: 'asc' },
      take: 6,
    }),
    prisma.product.findMany({
      where: { category: { slug: 'breakfast' }, isAvailable: true },
      select: productCardSelect,
      orderBy: { sortOrder: 'asc' },
      take: 5,
    }),
    prisma.product.findMany({
      where: { category: { slug: { in: ['pasta', 'sandwiches', 'salads'] } }, isAvailable: true },
      select: productCardSelect,
      orderBy: { orderCount: 'desc' },
      take: 6,
    }),
    prisma.product.findMany({
      where: { category: { slug: 'desserts' }, isAvailable: true },
      select: productCardSelect,
      orderBy: { sortOrder: 'asc' },
      take: 6,
    }),
    prisma.product.findMany({
      where: { isSeasonal: true, isAvailable: true },
      select: productCardSelect,
      orderBy: { sortOrder: 'asc' },
      take: 5,
    }),
    prisma.product.findMany({
      where: { isBestseller: true, isAvailable: true },
      select: productCardSelect,
      orderBy: { orderCount: 'desc' },
      take: 8,
    }),
  ]);

  return { signatureCoffee, breakfast, allDay, desserts, seasonal, bestsellers };
}
