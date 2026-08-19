import type { OrderStatus, OrderType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { orderDetailInclude, toOrderSummary } from './order.service';
import { isActive } from '../utils/orderFlow';

const EXCLUDE_CANCELLED = { orderStatus: { not: 'CANCELLED' as OrderStatus } };

function startOfDay(date = new Date()): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Headline metrics plus the series the dashboard charts. */
export async function getDashboard() {
  const today = startOfDay();
  const thirtyDaysAgo = startOfDay(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const yesterday = startOfDay(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const [todayAgg, yesterdayAgg, lifetimeAgg, customerCount, activeOrders, typeBreakdown, statusBreakdown] =
    await Promise.all([
      prisma.order.aggregate({
        where: { ...EXCLUDE_CANCELLED, createdAt: { gte: today } },
        _sum: { total: true },
        _count: true,
        _avg: { total: true },
      }),
      prisma.order.aggregate({
        where: { ...EXCLUDE_CANCELLED, createdAt: { gte: yesterday, lt: today } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({ where: EXCLUDE_CANCELLED, _sum: { total: true }, _count: true }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.order.count({
        where: { orderStatus: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } },
      }),
      prisma.order.groupBy({ by: ['orderType'], where: EXCLUDE_CANCELLED, _count: true, _sum: { total: true } }),
      prisma.order.groupBy({ by: ['orderStatus'], _count: true }),
    ]);

  // 30-day revenue and order series, zero-filled so the chart has no gaps.
  const recent = await prisma.order.findMany({
    where: { ...EXCLUDE_CANCELLED, createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, total: true },
  });

  const series = new Map<string, { date: string; revenue: number; orders: number }>();
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(thirtyDaysAgo);
    day.setDate(day.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    series.set(key, { date: key, revenue: 0, orders: 0 });
  }
  for (const order of recent) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const entry = series.get(key);
    if (entry) {
      entry.revenue += order.total;
      entry.orders += 1;
    }
  }

  const popular = await prisma.orderItem.groupBy({
    by: ['productNameSnapshot'],
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 8,
  });

  const revenueToday = todayAgg._sum.total ?? 0;
  const revenueYesterday = yesterdayAgg._sum.total ?? 0;

  return {
    metrics: {
      revenueToday,
      ordersToday: todayAgg._count,
      averageOrderValue: Math.round(todayAgg._avg.total ?? 0),
      customers: customerCount,
      activeOrders,
      lifetimeRevenue: lifetimeAgg._sum.total ?? 0,
      lifetimeOrders: lifetimeAgg._count,
      revenueChangePercent:
        revenueYesterday > 0 ? Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100) : null,
    },
    series: [...series.values()],
    orderTypes: (['DELIVERY', 'PICKUP', 'DINE_IN'] as OrderType[]).map((type) => {
      const found = typeBreakdown.find((entry) => entry.orderType === type);
      return { orderType: type, count: found?._count ?? 0, revenue: found?._sum.total ?? 0 };
    }),
    statuses: statusBreakdown.map((entry) => ({ status: entry.orderStatus, count: entry._count })),
    popularDishes: popular.map((entry) => ({
      name: entry.productNameSnapshot,
      quantity: entry._sum.quantity ?? 0,
      revenue: entry._sum.subtotal ?? 0,
    })),
  };
}

// ───────────────────────────────────────────────────────── order management

export async function listOrders(filter: {
  status?: OrderStatus;
  orderType?: OrderType;
  q?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.OrderWhereInput = {};
  if (filter.status) where.orderStatus = filter.status;
  if (filter.orderType) where.orderType = filter.orderType;

  if (filter.q) {
    where.OR = [
      { orderNumber: { contains: filter.q, mode: 'insensitive' } },
      { contactName: { contains: filter.q, mode: 'insensitive' } },
      { contactPhone: { contains: filter.q } },
      { user: { email: { contains: filter.q, mode: 'insensitive' } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderDetailInclude,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map(toOrderSummary),
    pagination: {
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
    },
  };
}

/** The kitchen board: only live orders, oldest first, with an age in minutes. */
export async function getKitchenBoard() {
  const orders = await prisma.order.findMany({
    where: {
      orderStatus: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
      OR: [{ paymentStatus: { in: ['SUCCESS', 'PENDING'] } }],
    },
    include: orderDetailInclude,
    orderBy: { createdAt: 'asc' },
    take: 60,
  });

  const now = Date.now();

  const cards = orders.map((order) => {
    const summary = toOrderSummary(order);
    const ageMinutes = Math.floor((now - order.createdAt.getTime()) / 60000);
    const target = order.estimatedReadyAt?.getTime() ?? order.createdAt.getTime() + 20 * 60000;

    return {
      ...summary,
      ageMinutes,
      /** Overdue against its own promised ready time. */
      isUrgent: isActive(order.orderStatus) && now > target,
      isScheduled: Boolean(order.scheduledFor),
      minutesUntilScheduled: order.scheduledFor
        ? Math.round((order.scheduledFor.getTime() - now) / 60000)
        : null,
    };
  });

  return {
    NEW: cards.filter((card) => card.orderStatus === 'PLACED'),
    PREPARING: cards.filter((card) => card.orderStatus === 'CONFIRMED' || card.orderStatus === 'PREPARING'),
    READY: cards.filter((card) => card.orderStatus === 'READY'),
    COMPLETED: cards.filter((card) => card.orderStatus === 'OUT_FOR_DELIVERY'),
  };
}

// ────────────────────────────────────────────────────────── menu management

export interface ProductWriteInput {
  categoryId: string;
  name: string;
  slug?: string;
  description: string;
  story?: string;
  basePrice: number;
  imageUrl: string;
  calories?: number;
  prepTimeMinutes?: number;
  ingredients?: string[];
  allergens?: string[];
  tags?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  containsEgg?: boolean;
  containsNuts?: boolean;
  containsGluten?: boolean;
  isSpicy?: boolean;
  isBestseller?: boolean;
  isNew?: boolean;
  isChefSpecial?: boolean;
  isSeasonal?: boolean;
  isAvailable?: boolean;
  modifierIds?: string[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function createProduct(input: ProductWriteInput) {
  const slug = input.slug?.trim() || slugify(input.name);
  const clash = await prisma.product.findUnique({ where: { slug } });
  if (clash) throw AppError.conflict('A dish with that name already exists.', 'SLUG_TAKEN');

  const { modifierIds, ...data } = input;

  return prisma.product.create({
    data: {
      ...data,
      slug,
      images: { create: [{ url: input.imageUrl, alt: input.name, sortOrder: 0 }] },
      ...(modifierIds?.length
        ? { modifiers: { create: modifierIds.map((id, index) => ({ modifierId: id, sortOrder: index })) } }
        : {}),
    },
  });
}

export async function updateProduct(id: string, input: Partial<ProductWriteInput>) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('We couldn’t find that dish.', 'PRODUCT_NOT_FOUND');

  const { modifierIds, ...data } = input;

  if (modifierIds) {
    await prisma.productModifier.deleteMany({ where: { productId: id } });
    await prisma.productModifier.createMany({
      data: modifierIds.map((modifierId, index) => ({ productId: id, modifierId, sortOrder: index })),
    });
  }

  return prisma.product.update({ where: { id }, data });
}

export async function deleteProduct(id: string) {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!existing) throw AppError.notFound('We couldn’t find that dish.', 'PRODUCT_NOT_FOUND');

  // A dish that appears in order history is retired rather than deleted, so
  // historical receipts keep their product link.
  if (existing._count.orderItems > 0) {
    await prisma.product.update({ where: { id }, data: { isAvailable: false } });
    return { ok: true, retired: true };
  }

  await prisma.product.delete({ where: { id } });
  return { ok: true, retired: false };
}

export async function setAvailability(id: string, isAvailable: boolean) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('We couldn’t find that dish.', 'PRODUCT_NOT_FOUND');
  return prisma.product.update({ where: { id }, data: { isAvailable } });
}

export async function listAllProductsForAdmin() {
  const products = await prisma.product.findMany({
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      modifiers: { select: { modifierId: true } },
      _count: { select: { orderItems: true, reviews: true } },
    },
  });

  return products.map(({ modifiers, _count, ...product }) => ({
    ...product,
    modifierIds: modifiers.map((m) => m.modifierId),
    orderItemCount: _count.orderItems,
    reviewCount: _count.reviews,
  }));
}

export function listModifiers() {
  return prisma.modifier.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function createCategory(input: { name: string; description?: string; imageUrl?: string }) {
  const slug = slugify(input.name);
  const clash = await prisma.category.findUnique({ where: { slug } });
  if (clash) throw AppError.conflict('A category with that name already exists.', 'SLUG_TAKEN');

  const last = await prisma.category.findFirst({ orderBy: { sortOrder: 'desc' } });
  return prisma.category.create({
    data: { ...input, slug, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
}

// ──────────────────────────────────────────────────────── customers & coupons

export async function listCustomers(q?: string) {
  const customers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    // Authentication material is never selected, so it can't leak into a response.
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      orders: {
        where: EXCLUDE_CANCELLED,
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return customers.map(({ orders, ...customer }) => ({
    ...customer,
    orderCount: orders.length,
    totalSpent: orders.reduce((sum, order) => sum + order.total, 0),
    lastOrderAt: orders[0]?.createdAt ?? null,
  }));
}

export function listCoupons() {
  return prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { usages: true } } },
  });
}

export async function upsertCoupon(input: {
  id?: string;
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  maxUses?: number | null;
  maxUsesPerUser?: number;
  expiresAt?: string | null;
  isActive?: boolean;
}) {
  const data = {
    code: input.code.trim().toUpperCase(),
    description: input.description,
    discountType: input.discountType,
    discountValue: input.discountValue,
    minOrderAmount: input.minOrderAmount ?? 0,
    maxDiscount: input.maxDiscount ?? null,
    maxUses: input.maxUses ?? null,
    maxUsesPerUser: input.maxUsesPerUser ?? 1,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    isActive: input.isActive ?? true,
  };

  if (input.id) return prisma.coupon.update({ where: { id: input.id }, data });
  return prisma.coupon.create({ data });
}
