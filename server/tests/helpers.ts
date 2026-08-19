import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';
import { prisma } from '../src/config/prisma';
import { createApp } from '../src/app';
import { ensureOrderNumberSequence } from '../src/utils/orderNumber';

export const PASSWORD = 'TestPass123!';

export interface Fixtures {
  app: Express;
  customer: { id: string; email: string };
  otherCustomer: { id: string; email: string };
  admin: { id: string; email: string };
  cafeId: string;
  tableToken: string;
  /** Cappuccino: ₹210 base, required Size + Milk + Sweetness, optional add-ons. */
  coffee: {
    id: string;
    slug: string;
    basePrice: number;
    sizeMedium: string;
    milkOat: string;
    sugarNone: string;
    extraShot: string;
  };
  /** A dish with no modifiers, marked unavailable. */
  soldOutId: string;
  /** A plain available dish with no modifiers. */
  cookieId: string;
}

/** Wipes every table, in FK-safe order. */
export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.couponUsage.deleteMany(),
    prisma.orderItemModifier.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.deliveryAddress.deleteMany(),
    prisma.review.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItemModifier.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.wishlist.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.address.deleteMany(),
    prisma.productModifier.deleteMany(),
    prisma.modifierOption.deleteMany(),
    prisma.modifier.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.cafeTable.deleteMany(),
    prisma.operatingHour.deleteMany(),
    prisma.cafe.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.user.deleteMany(),
    prisma.setting.deleteMany(),
  ]);
}

/**
 * Builds a minimal but realistic dataset: one café open around the clock (so
 * opening-hours gating never makes tests time-dependent), one customisable
 * coffee, one plain item, one sold-out item, and three accounts.
 */
export async function seedFixtures(): Promise<Fixtures> {
  await resetDatabase();
  await ensureOrderNumberSequence();

  await prisma.setting.create({
    data: {
      id: 'singleton',
      taxRatePercent: 5,
      deliveryFee: 49,
      expressDeliveryFee: 89,
      freeDeliveryThreshold: 499,
      packagingFee: 0,
    },
  });

  const cafe = await prisma.cafe.create({
    data: {
      name: 'Test Café',
      slug: 'test-cafe',
      line1: '1 Test Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      phone: '+91 80 0000 0000',
      // Open 00:00–24:00 every day so hour gating is deterministic.
      hours: {
        create: Array.from({ length: 7 }, (_, day) => ({
          dayOfWeek: day,
          opensAt: 0,
          closesAt: 24 * 60,
          isClosed: false,
        })),
      },
      tables: { create: { label: 'T01', floor: 'Ground', capacity: 2 } },
    },
    include: { tables: true },
  });

  const category = await prisma.category.create({
    data: { name: 'Coffee', slug: 'coffee', description: 'Test coffee', sortOrder: 0 },
  });

  const size = await prisma.modifier.create({
    data: {
      name: 'Size',
      selectionType: 'SINGLE',
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      options: {
        create: [
          { name: 'Small', priceDelta: 0, isDefault: true, sortOrder: 0 },
          { name: 'Medium', priceDelta: 30, sortOrder: 1 },
          { name: 'Large', priceDelta: 55, sortOrder: 2 },
        ],
      },
    },
    include: { options: true },
  });

  const milk = await prisma.modifier.create({
    data: {
      name: 'Milk',
      selectionType: 'SINGLE',
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      options: {
        create: [
          { name: 'Whole Milk', priceDelta: 0, isDefault: true, sortOrder: 0 },
          { name: 'Oat Milk', priceDelta: 60, sortOrder: 1 },
        ],
      },
    },
    include: { options: true },
  });

  const sweetness = await prisma.modifier.create({
    data: {
      name: 'Sweetness',
      selectionType: 'SINGLE',
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      options: {
        create: [
          { name: 'No Sugar', priceDelta: 0, isDefault: true, sortOrder: 0 },
          { name: 'Regular', priceDelta: 0, sortOrder: 1 },
        ],
      },
    },
    include: { options: true },
  });

  const addons = await prisma.modifier.create({
    data: {
      name: 'Add-ons',
      selectionType: 'MULTI',
      isRequired: false,
      minSelect: 0,
      maxSelect: 2,
      options: {
        create: [
          { name: 'Extra Espresso Shot', priceDelta: 50, sortOrder: 0 },
          { name: 'Vanilla', priceDelta: 30, sortOrder: 1 },
        ],
      },
    },
    include: { options: true },
  });

  const cappuccino = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: 'Cappuccino',
      slug: 'cappuccino',
      description: 'Espresso, steamed milk and a dense foam.',
      basePrice: 210,
      imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d',
      tags: ['coffee', 'milk'],
      modifiers: {
        create: [
          { modifierId: size.id, sortOrder: 0 },
          { modifierId: milk.id, sortOrder: 1 },
          { modifierId: sweetness.id, sortOrder: 2 },
          { modifierId: addons.id, sortOrder: 3 },
        ],
      },
    },
  });

  const cookie = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: 'Chocolate Chip Cookie',
      slug: 'chocolate-chip-cookie',
      description: 'Brown-butter dough with sea salt on top.',
      basePrice: 150,
      imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e',
      tags: ['bakery'],
    },
  });

  const soldOut = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: 'Pain au Chocolat',
      slug: 'pain-au-chocolat',
      description: 'Two batons of dark chocolate in croissant dough.',
      basePrice: 210,
      imageUrl: 'https://images.unsplash.com/photo-1481931098730-318b6f776db0',
      isAvailable: false,
    },
  });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const customer = await prisma.user.create({
    data: {
      name: 'Test Customer',
      email: 'customer@test.local',
      phone: '+91 90000 00001',
      passwordHash,
      role: 'CUSTOMER',
      cart: { create: {} },
      wishlist: { create: {} },
    },
  });

  const otherCustomer = await prisma.user.create({
    data: {
      name: 'Other Customer',
      email: 'other@test.local',
      phone: '+91 90000 00002',
      passwordHash,
      role: 'CUSTOMER',
      cart: { create: {} },
      wishlist: { create: {} },
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Test Admin',
      email: 'admin@test.local',
      phone: '+91 90000 00003',
      passwordHash,
      role: 'ADMIN',
      cart: { create: {} },
      wishlist: { create: {} },
    },
  });

  await prisma.address.create({
    data: {
      userId: customer.id,
      fullName: 'Test Customer',
      phone: '+91 90000 00001',
      line1: '402 Test Apartments',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      isDefault: true,
    },
  });

  await prisma.coupon.create({
    data: {
      code: 'TEST10',
      description: '10% off, up to ₹100',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscount: 100,
      maxUsesPerUser: 1,
    },
  });

  const find = (options: { id: string; name: string }[], name: string) =>
    options.find((option) => option.name === name)!.id;

  return {
    app: createApp(),
    customer: { id: customer.id, email: customer.email },
    otherCustomer: { id: otherCustomer.id, email: otherCustomer.email },
    admin: { id: admin.id, email: admin.email },
    cafeId: cafe.id,
    tableToken: cafe.tables[0]!.qrToken,
    coffee: {
      id: cappuccino.id,
      slug: cappuccino.slug,
      basePrice: cappuccino.basePrice,
      sizeMedium: find(size.options, 'Medium'),
      milkOat: find(milk.options, 'Oat Milk'),
      sugarNone: find(sweetness.options, 'No Sugar'),
      extraShot: find(addons.options, 'Extra Espresso Shot'),
    },
    soldOutId: soldOut.id,
    cookieId: cookie.id,
  };
}

/** Signs in and returns a bearer token plus the raw refresh cookie. */
export async function login(app: Express, email: string): Promise<{ token: string; cookie: string[] }> {
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);

  const setCookie = response.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];

  return { token: response.body.accessToken as string, cookie };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` } as const;
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
