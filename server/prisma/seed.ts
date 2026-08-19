import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  type DeliverySpeed,
  type ModifierOption,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type PaymentStatus,
  type Prisma,
} from '@prisma/client';
import { IMG, img } from './seed-data/images';
import { MENU, MODIFIERS, type ModifierKey } from './seed-data/menu';
import {
  computeTotals,
  describeModifiers,
  lineSubtotal,
  unitPriceFor,
  type PricedLine,
  type SelectedModifier,
} from '../src/services/pricing.service';
import { ensureOrderNumberSequence } from '../src/utils/orderNumber';

const prisma = new PrismaClient();

/** Deterministic PRNG so every `db:seed` produces the same demo dataset. */
let seedState = 20260817;
function rand(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

const DEMO_PASSWORDS = {
  admin: 'AdminDemo123!',
  staff: 'KitchenDemo123!',
  customer: 'DemoCustomer123!',
};

// ───────────────────────────────────────────────────────────── locations

const CAFES = [
  {
    name: 'Indiranagar',
    slug: 'indiranagar',
    tagline: 'Our first room. Twelve seats, one long counter.',
    line1: '12/3, Ground Floor, 100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    phone: '+91 80 4718 2200',
    image: IMG.heroInterior,
    latitude: 12.9719,
    longitude: 77.6412,
    tableCount: 20,
  },
  {
    name: 'Koramangala',
    slug: 'koramangala',
    tagline: 'The big one — a mezzanine, a roastery window, long tables.',
    line1: '48, 5th Block, 80 Feet Road, Koramangala',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560095',
    phone: '+91 80 4718 2201',
    image: IMG.interiorWarm,
    latitude: 12.9352,
    longitude: 77.6245,
    tableCount: 18,
  },
  {
    name: 'Bandra West',
    slug: 'bandra-west',
    tagline: 'Corner windows, sea breeze, and a queue by nine.',
    line1: '7, Ambedkar Road, Pali Naka, Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400050',
    phone: '+91 22 4718 2202',
    image: IMG.window,
    latitude: 19.0607,
    longitude: 72.8302,
    tableCount: 14,
  },
  {
    name: 'Powai',
    slug: 'powai',
    tagline: 'Lakeside, laptop-friendly, open latest of all.',
    line1: 'Unit 4, Central Avenue, Hiranandani Gardens, Powai',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400076',
    phone: '+91 22 4718 2203',
    image: IMG.communal,
    latitude: 19.1197,
    longitude: 72.9051,
    tableCount: 16,
  },
  {
    name: 'Jubilee Hills',
    slug: 'jubilee-hills',
    tagline: 'A courtyard, a fig tree, and the quietest afternoons we have.',
    line1: 'Plot 32, Road No. 36, Jubilee Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500033',
    phone: '+91 40 4718 2204',
    image: IMG.exterior,
    latitude: 17.4326,
    longitude: 78.4071,
    tableCount: 16,
  },
] as const;

/** Mon–Fri 8:00 AM – 11:00 PM, Sat–Sun 8:00 AM – 12:00 AM (1440 = midnight). */
function hoursFor(dayOfWeek: number) {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  return { dayOfWeek, opensAt: 8 * 60, closesAt: isWeekend ? 24 * 60 : 23 * 60, isClosed: false };
}

const FLOORS = ['Ground', 'Ground', 'Mezzanine', 'Courtyard'];

// ───────────────────────────────────────────────────────────── customers

const CUSTOMERS = [
  { name: 'Priyansh Sen', email: 'demo@demo-cafe.com', phone: '+91 98450 11223', isPrimary: true },
  { name: 'Ananya Iyer', email: 'ananya.iyer@example.com', phone: '+91 98450 44551' },
  { name: 'Rohan Mehta', email: 'rohan.mehta@example.com', phone: '+91 99870 21134' },
  { name: 'Aisha Qureshi', email: 'aisha.qureshi@example.com', phone: '+91 98201 77420' },
  { name: 'Karthik Raman', email: 'karthik.raman@example.com', phone: '+91 90080 33219' },
  { name: 'Meera Nair', email: 'meera.nair@example.com', phone: '+91 97410 88265' },
  { name: 'Devansh Kapoor', email: 'devansh.kapoor@example.com', phone: '+91 98110 55603' },
  { name: 'Sneha Bhatt', email: 'sneha.bhatt@example.com', phone: '+91 96320 44178' },
] as const;

const REVIEW_TEXTS = [
  { rating: 5, title: 'Best in the city', comment: 'The best flat white I’ve had in Bengaluru. Consistent every single visit.' },
  { rating: 5, title: 'Worth the detour', comment: 'Came for the cold brew, stayed for the cheesecake. The staff actually know their coffee.' },
  { rating: 4, title: 'Lovely, if busy', comment: 'Excellent food and a beautiful room. Do go before eleven on weekends.' },
  { rating: 5, title: 'Genuinely special', comment: 'That truffle pasta is the real thing — not a cream sauce with truffle oil dumped on it.' },
  { rating: 4, title: 'Very good', comment: 'Well balanced and not too sweet, which is rare. Portion could be slightly bigger.' },
  { rating: 5, title: 'My weekend routine', comment: 'I order this every Saturday. Arrives hot even on delivery, which says something.' },
  { rating: 5, title: 'Perfectly made', comment: 'Beautifully textured milk and a proper ristretto base. You can taste the care.' },
  { rating: 4, title: 'Solid choice', comment: 'Fresh, generous and nicely dressed. Would happily order again.' },
];

// ─────────────────────────────────────────────────────────────── helpers

async function reset() {
  // Ordered to respect foreign keys even though most relations cascade.
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

async function main() {
  console.log('\n  ALAAP — seeding demo data\n');
  await reset();

  // ── settings ─────────────────────────────────────────────────────────────
  await prisma.setting.create({
    data: {
      id: 'singleton',
      taxRatePercent: 5,
      deliveryFee: 49,
      expressDeliveryFee: 89,
      freeDeliveryThreshold: 499,
      packagingFee: 0,
      onlinePaymentFeePercent: 2,
    },
  });
  const settings = await prisma.setting.findUniqueOrThrow({ where: { id: 'singleton' } });

  // ── cafés, hours, tables ─────────────────────────────────────────────────
  const cafes = [];
  for (const [index, cafe] of CAFES.entries()) {
    const created = await prisma.cafe.create({
      data: {
        name: cafe.name,
        slug: cafe.slug,
        tagline: cafe.tagline,
        line1: cafe.line1,
        city: cafe.city,
        state: cafe.state,
        postalCode: cafe.postalCode,
        phone: cafe.phone,
        email: `${cafe.slug}@alaap.coffee`,
        imageUrl: img(cafe.image, 1400),
        latitude: cafe.latitude,
        longitude: cafe.longitude,
        sortOrder: index,
        hours: { create: Array.from({ length: 7 }, (_, day) => hoursFor(day)) },
        tables: {
          create: Array.from({ length: cafe.tableCount }, (_, i) => ({
            label: `T${String(i + 1).padStart(2, '0')}`,
            floor: FLOORS[i % FLOORS.length]!,
            capacity: i % 5 === 4 ? 6 : i % 3 === 2 ? 4 : 2,
            status: 'AVAILABLE' as const,
          })),
        },
      },
      include: { tables: true },
    });
    cafes.push(created);
  }
  console.log(`  ✓ ${cafes.length} cafés, ${cafes.reduce((n, c) => n + c.tables.length, 0)} tables`);

  // ── modifiers ────────────────────────────────────────────────────────────
  const modifierByKey = new Map<ModifierKey, { id: string; options: ModifierOption[] }>();
  for (const [index, modifier] of MODIFIERS.entries()) {
    const created = await prisma.modifier.create({
      data: {
        name: modifier.name,
        description: modifier.description,
        selectionType: modifier.selectionType,
        isRequired: modifier.isRequired,
        minSelect: modifier.minSelect,
        maxSelect: modifier.maxSelect,
        sortOrder: index,
        options: {
          create: modifier.options.map((option, optionIndex) => ({
            name: option.name,
            priceDelta: option.priceDelta,
            isDefault: option.isDefault ?? false,
            sortOrder: optionIndex,
          })),
        },
      },
      include: { options: true },
    });
    modifierByKey.set(modifier.key, { id: created.id, options: created.options });
  }
  console.log(`  ✓ ${MODIFIERS.length} modifier groups`);

  // ── catalogue ────────────────────────────────────────────────────────────
  let productCount = 0;
  const allProducts: { id: string; slug: string; name: string; basePrice: number; imageUrl: string; categorySlug: string; modifierKeys: ModifierKey[] }[] = [];

  for (const [categoryIndex, category] of MENU.entries()) {
    const createdCategory = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: img(category.image, 1200),
        sortOrder: categoryIndex,
      },
    });

    for (const [productIndex, product] of category.products.entries()) {
      const created = await prisma.product.create({
        data: {
          categoryId: createdCategory.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          story: product.story,
          basePrice: product.basePrice,
          imageUrl: img(product.image, 1200, 900),
          calories: product.calories,
          prepTimeMinutes: product.prepTimeMinutes ?? 10,
          ingredients: product.ingredients,
          allergens: product.allergens ?? [],
          tags: product.tags,
          isVegetarian: !product.nonVeg,
          isVegan: product.vegan ?? false,
          containsEgg: product.egg ?? false,
          containsNuts: product.nuts ?? false,
          containsGluten: product.gluten ?? false,
          isSpicy: product.spicy ?? false,
          isBestseller: product.bestseller ?? false,
          isNew: product.isNew ?? false,
          isChefSpecial: product.chefSpecial ?? false,
          isSeasonal: product.seasonal ?? false,
          ratingAvg: product.rating ?? 0,
          ratingCount: product.ratingCount ?? 0,
          orderCount: product.orderCount ?? 0,
          sortOrder: productIndex,
          images: {
            create: [{ url: img(product.image, 1600, 1200), alt: `${product.name} at ALAAP`, sortOrder: 0 }],
          },
          modifiers: {
            create: product.modifiers.map((key, i) => ({
              modifierId: modifierByKey.get(key)!.id,
              sortOrder: i,
            })),
          },
        },
      });

      allProducts.push({
        id: created.id,
        slug: created.slug,
        name: created.name,
        basePrice: created.basePrice,
        imageUrl: created.imageUrl,
        categorySlug: category.slug,
        modifierKeys: product.modifiers,
      });
      productCount += 1;
    }
  }

  // One dish is intentionally sold out so the "currently unavailable" state is
  // visible in the demo without an admin edit.
  await prisma.product.update({ where: { slug: 'pain-au-chocolat' }, data: { isAvailable: false } });
  console.log(`  ✓ ${MENU.length} categories, ${productCount} dishes`);

  // ── coupons ──────────────────────────────────────────────────────────────
  const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  await prisma.coupon.createMany({
    data: [
      {
        code: 'WELCOME10',
        description: '10% off your first order, up to ₹150',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        minOrderAmount: 0,
        maxDiscount: 150,
        maxUsesPerUser: 1,
        expiresAt: in60Days,
      },
      {
        code: 'SLOWMORNING',
        description: '15% off orders over ₹499, up to ₹200',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        minOrderAmount: 499,
        maxDiscount: 200,
        maxUsesPerUser: 3,
        expiresAt: in60Days,
      },
      {
        code: 'ALAAP150',
        description: '₹150 off orders over ₹799',
        discountType: 'FIXED',
        discountValue: 150,
        minOrderAmount: 799,
        maxUsesPerUser: 2,
        expiresAt: in60Days,
      },
      {
        code: 'FIRSTBREW',
        description: '₹100 off orders over ₹399',
        discountType: 'FIXED',
        discountValue: 100,
        minOrderAmount: 399,
        maxUses: 500,
        maxUsesPerUser: 1,
        expiresAt: in60Days,
      },
    ],
  });
  console.log('  ✓ 4 coupons');

  // ── people ───────────────────────────────────────────────────────────────
  const [adminHash, staffHash, customerHash] = await Promise.all([
    bcrypt.hash(DEMO_PASSWORDS.admin, 12),
    bcrypt.hash(DEMO_PASSWORDS.staff, 12),
    bcrypt.hash(DEMO_PASSWORDS.customer, 12),
  ]);

  await prisma.user.create({
    data: {
      name: 'Nikhil Deshpande',
      email: 'admin@demo-cafe.com',
      phone: '+91 80 4718 2200',
      passwordHash: adminHash,
      role: 'ADMIN',
      cart: { create: {} },
      wishlist: { create: {} },
    },
  });

  await prisma.user.create({
    data: {
      name: 'Kitchen Station',
      email: 'kitchen@demo-cafe.com',
      phone: '+91 80 4718 2210',
      passwordHash: staffHash,
      role: 'STAFF',
      cart: { create: {} },
      wishlist: { create: {} },
    },
  });

  const customers = [];
  for (const customer of CUSTOMERS) {
    const created = await prisma.user.create({
      data: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        passwordHash: customerHash,
        role: 'CUSTOMER',
        cart: { create: {} },
        wishlist: { create: {} },
      },
    });
    customers.push({ ...created, isPrimary: 'isPrimary' in customer });
  }

  const primary = customers.find((c) => c.isPrimary)!;

  // Three saved addresses for the demo account, as the account overview shows.
  await prisma.address.createMany({
    data: [
      {
        userId: primary.id,
        label: 'Home',
        fullName: primary.name,
        phone: primary.phone,
        line1: '402, Sterling Residency, 5th Cross',
        line2: 'Indiranagar 1st Stage',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        addressType: 'HOME',
        isDefault: true,
        instructions: 'Gate code 4402. Please call from the lobby.',
      },
      {
        userId: primary.id,
        label: 'Studio',
        fullName: primary.name,
        phone: primary.phone,
        line1: 'WeWork Galaxy, 43 Residency Road',
        line2: '4th Floor, Desk 21',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560025',
        addressType: 'WORK',
        instructions: 'Leave at the front desk if I don’t answer.',
      },
      {
        userId: primary.id,
        label: 'Parents',
        fullName: 'Sunita Sen',
        phone: '+91 98450 90031',
        line1: '11, Dollars Colony, RMV Extension',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560094',
        addressType: 'OTHER',
      },
    ],
  });

  for (const customer of customers.slice(1)) {
    await prisma.address.create({
      data: {
        userId: customer.id,
        label: 'Home',
        fullName: customer.name,
        phone: customer.phone,
        line1: `${randInt(10, 99)}, ${pick(['Palm Grove', 'Rosewood Apartments', 'Skyline Terrace', 'Casa Del Sol'])}`,
        city: pick(['Bengaluru', 'Mumbai', 'Hyderabad']),
        state: pick(['Karnataka', 'Maharashtra', 'Telangana']),
        postalCode: String(randInt(400001, 560100)),
        addressType: 'HOME',
        isDefault: true,
      },
    });
  }
  console.log(`  ✓ ${customers.length + 2} accounts (1 admin, 1 kitchen, ${customers.length} customers)`);

  // ── wishlist for the demo account ────────────────────────────────────────
  const wishlist = await prisma.wishlist.findUniqueOrThrow({ where: { userId: primary.id } });
  const favouriteSlugs = ['truffle-mushroom-pasta', 'spanish-latte', 'basque-cheesecake', 'alaap-filter-coffee'];
  for (const slug of favouriteSlugs) {
    const product = allProducts.find((p) => p.slug === slug);
    if (product) {
      await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId: product.id } });
    }
  }

  // ── orders ───────────────────────────────────────────────────────────────
  const addressesByUser = new Map<string, Awaited<ReturnType<typeof prisma.address.findMany>>>();
  for (const customer of customers) {
    addressesByUser.set(customer.id, await prisma.address.findMany({ where: { userId: customer.id } }));
  }

  /** Builds a priced order the same way the checkout service does. */
  function buildLines(count: number): { lines: PricedLine[]; picked: typeof allProducts } {
    const chosen: typeof allProducts = [];
    const lines: PricedLine[] = [];

    for (let i = 0; i < count; i += 1) {
      const product = pick(allProducts);
      if (chosen.some((c) => c.id === product.id)) continue;
      chosen.push(product);

      const selected: SelectedModifier[] = [];
      for (const key of product.modifierKeys) {
        const group = modifierByKey.get(key);
        if (!group) continue;
        const definition = MODIFIERS.find((m) => m.key === key)!;
        if (definition.selectionType === 'SINGLE') {
          if (definition.isRequired || rand() > 0.5) {
            const option = pick(group.options);
            selected.push({
              modifierId: group.id,
              modifierName: definition.name,
              optionId: option.id,
              optionName: option.name,
              priceDelta: option.priceDelta,
            });
          }
        } else if (rand() > 0.6) {
          const option = pick(group.options);
          selected.push({
            modifierId: group.id,
            modifierName: definition.name,
            optionId: option.id,
            optionName: option.name,
            priceDelta: option.priceDelta,
          });
        }
      }

      const quantity = rand() > 0.75 ? 2 : 1;
      const unitPrice = unitPriceFor(product.basePrice, selected);
      lines.push({
        productId: product.id,
        name: product.name,
        image: product.imageUrl,
        basePrice: product.basePrice,
        unitPrice,
        quantity,
        subtotal: lineSubtotal(unitPrice, quantity),
        modifiers: selected,
      });
    }

    return { lines, picked: chosen };
  }

  const HISTORY: { status: OrderStatus; type: OrderType }[] = [];
  let orderSequence = 1048;

  async function createOrder(input: {
    userId: string;
    contactName: string;
    contactPhone: string;
    orderType: OrderType;
    orderStatus: OrderStatus;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    createdAt: Date;
    lineCount: number;
    cafeId: string;
    tableId?: string;
    address?: { fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; postalCode: string; instructions: string | null };
    deliverySpeed?: DeliverySpeed;
  }) {
    const { lines } = buildLines(input.lineCount);
    if (lines.length === 0) return null;

    const totals = computeTotals({
      lines,
      orderType: input.orderType,
      settings,
      deliverySpeed: input.deliverySpeed,
    });

    const prepMinutes = 15 + lines.length * 3;
    orderSequence += 1;

    const statusFlow: OrderStatus[] = (() => {
      const base: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'];
      const tail: Record<OrderType, OrderStatus[]> = {
        DELIVERY: ['OUT_FOR_DELIVERY', 'DELIVERED'],
        PICKUP: ['COLLECTED'],
        DINE_IN: ['SERVED'],
      };
      const full = [...base, ...tail[input.orderType]];
      if (input.orderStatus === 'CANCELLED') return ['PLACED', 'CANCELLED'];
      const index = full.indexOf(input.orderStatus);
      return index === -1 ? ['PLACED'] : full.slice(0, index + 1);
    })();

    const order = await prisma.order.create({
      data: {
        orderNumber: `CA-${orderSequence}`,
        userId: input.userId,
        orderType: input.orderType,
        cafeId: input.cafeId,
        tableId: input.tableId,
        deliverySpeed: input.orderType === 'DELIVERY' ? (input.deliverySpeed ?? 'STANDARD') : null,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus,
        orderStatus: input.orderStatus,
        createdAt: input.createdAt,
        estimatedReadyAt: new Date(input.createdAt.getTime() + prepMinutes * 60 * 1000),
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            productNameSnapshot: line.name,
            productImageSnapshot: line.image,
            unitPriceSnapshot: line.unitPrice,
            quantity: line.quantity,
            subtotal: line.subtotal,
            customizationSnapshot: (line.modifiers.length
              ? { summary: describeModifiers(line.modifiers), options: line.modifiers.map((m) => ({ group: m.modifierName, option: m.optionName, priceDelta: m.priceDelta })) }
              : undefined) as Prisma.InputJsonValue | undefined,
            modifiers: {
              create: line.modifiers.map((modifier) => ({
                modifierNameSnapshot: modifier.modifierName,
                optionNameSnapshot: modifier.optionName,
                priceDeltaSnapshot: modifier.priceDelta,
              })),
            },
          })),
        },
        statusHistory: {
          create: statusFlow.map((status, index) => ({
            status,
            createdAt: new Date(input.createdAt.getTime() + index * 6 * 60 * 1000),
          })),
        },
        payments: {
          create: {
            provider: input.paymentMethod === 'COD' || input.paymentMethod === 'PAY_AT_COUNTER' ? 'CASH' : 'MOCK',
            amount: totals.total,
            method: input.paymentMethod,
            status: input.paymentStatus,
            providerOrderId: input.paymentMethod === 'COD' || input.paymentMethod === 'PAY_AT_COUNTER' ? null : `mock_order_${orderSequence}`,
            providerPaymentId:
              input.paymentStatus === 'SUCCESS' && input.paymentMethod !== 'COD' && input.paymentMethod !== 'PAY_AT_COUNTER'
                ? `mock_pay_${orderSequence}`
                : null,
            createdAt: input.createdAt,
          },
        },
        ...(input.address
          ? {
              deliveryAddress: {
                create: {
                  fullName: input.address.fullName,
                  phone: input.address.phone,
                  line1: input.address.line1,
                  line2: input.address.line2,
                  city: input.address.city,
                  state: input.address.state,
                  postalCode: input.address.postalCode,
                  instructions: input.address.instructions,
                },
              },
            }
          : {}),
      },
    });

    HISTORY.push({ status: input.orderStatus, type: input.orderType });
    return order;
  }

  const ONLINE_METHODS: PaymentMethod[] = ['UPI', 'CARD', 'NETBANKING'];

  // 30 days of completed history, weighted towards recent days.
  for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
    const ordersToday = daysAgo === 0 ? 6 : randInt(2, 5);

    for (let i = 0; i < ordersToday; i += 1) {
      const customer = pick(customers);
      const cafe = pick(cafes);
      const orderType = pick<OrderType>(['DELIVERY', 'PICKUP', 'DINE_IN', 'DINE_IN', 'DELIVERY']);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      createdAt.setHours(randInt(8, 21), randInt(0, 59), 0, 0);

      // Never timestamp demo orders in the future. Seeding at 3am would
      // otherwise place a "today, 2pm" order ahead of a genuinely new one in
      // order history, and count revenue that hasn't happened yet.
      if (createdAt.getTime() > Date.now()) {
        createdAt.setDate(createdAt.getDate() - 1);
      }

      const cancelled = rand() > 0.94;
      const terminal: Record<OrderType, OrderStatus> = { DELIVERY: 'DELIVERED', PICKUP: 'COLLECTED', DINE_IN: 'SERVED' };
      const address = orderType === 'DELIVERY' ? addressesByUser.get(customer.id)?.[0] : undefined;

      const paymentMethod: PaymentMethod =
        orderType === 'DELIVERY'
          ? rand() > 0.8
            ? 'COD'
            : pick(ONLINE_METHODS)
          : rand() > 0.7
            ? 'PAY_AT_COUNTER'
            : pick(ONLINE_METHODS);

      await createOrder({
        userId: customer.id,
        contactName: customer.name,
        contactPhone: customer.phone,
        orderType,
        orderStatus: cancelled ? 'CANCELLED' : terminal[orderType],
        paymentMethod,
        paymentStatus: cancelled ? 'FAILED' : paymentMethod === 'COD' || paymentMethod === 'PAY_AT_COUNTER' ? 'SUCCESS' : 'SUCCESS',
        createdAt,
        lineCount: randInt(1, 4),
        cafeId: cafe.id,
        tableId: orderType === 'DINE_IN' ? pick(cafe.tables).id : undefined,
        address: address
          ? {
              fullName: address.fullName,
              phone: address.phone,
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              instructions: address.instructions,
            }
          : undefined,
        deliverySpeed: rand() > 0.75 ? 'EXPRESS' : 'STANDARD',
      });
    }
  }

  // Live orders sitting on the kitchen board right now, one per column.
  const liveStates: { status: OrderStatus; type: OrderType; minutesAgo: number }[] = [
    { status: 'PLACED', type: 'DINE_IN', minutesAgo: 2 },
    { status: 'PLACED', type: 'DELIVERY', minutesAgo: 6 },
    { status: 'CONFIRMED', type: 'PICKUP', minutesAgo: 9 },
    { status: 'PREPARING', type: 'DINE_IN', minutesAgo: 14 },
    { status: 'PREPARING', type: 'DELIVERY', minutesAgo: 18 },
    { status: 'READY', type: 'PICKUP', minutesAgo: 23 },
    { status: 'READY', type: 'DINE_IN', minutesAgo: 27 },
    { status: 'OUT_FOR_DELIVERY', type: 'DELIVERY', minutesAgo: 34 },
  ];

  const homeCafe = cafes[0]!;
  for (const live of liveStates) {
    const customer = live.type === 'DINE_IN' ? primary : pick(customers);
    const address = live.type === 'DELIVERY' ? addressesByUser.get(customer.id)?.[0] : undefined;

    await createOrder({
      userId: customer.id,
      contactName: customer.name,
      contactPhone: customer.phone,
      orderType: live.type,
      orderStatus: live.status,
      paymentMethod: live.type === 'DINE_IN' ? 'PAY_AT_COUNTER' : pick(ONLINE_METHODS),
      paymentStatus: live.type === 'DINE_IN' ? 'PENDING' : 'SUCCESS',
      createdAt: new Date(Date.now() - live.minutesAgo * 60 * 1000),
      lineCount: randInt(1, 3),
      cafeId: homeCafe.id,
      tableId: live.type === 'DINE_IN' ? pick(homeCafe.tables).id : undefined,
      address: address
        ? {
            fullName: address.fullName,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            instructions: address.instructions,
          }
        : undefined,
    });
  }

  // Tables with a live dine-in order should read as occupied.
  const occupied = await prisma.order.findMany({
    where: { orderType: 'DINE_IN', orderStatus: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'] }, tableId: { not: null } },
    select: { tableId: true },
  });
  await prisma.cafeTable.updateMany({
    where: { id: { in: occupied.map((o) => o.tableId!) } },
    data: { status: 'OCCUPIED' },
  });

  const orderTotal = await prisma.order.count();
  console.log(`  ✓ ${orderTotal} orders (${liveStates.length} live on the kitchen board)`);

  // ── reviews, tied to real delivered orders ───────────────────────────────
  let reviewCount = 0;
  for (const customer of customers) {
    const delivered = await prisma.order.findMany({
      where: { userId: customer.id, orderStatus: { in: ['DELIVERED', 'COLLECTED', 'SERVED'] } },
      include: { items: true },
      take: 4,
    });

    for (const order of delivered) {
      for (const item of order.items) {
        if (!item.productId || rand() > 0.45) continue;

        const existing = await prisma.review.findUnique({
          where: { userId_productId: { userId: customer.id, productId: item.productId } },
        });
        if (existing) continue;

        const text = pick(REVIEW_TEXTS);
        await prisma.review.create({
          data: {
            userId: customer.id,
            productId: item.productId,
            orderId: order.id,
            rating: text.rating,
            title: text.title,
            comment: text.comment,
            isVerified: true,
            createdAt: new Date(order.createdAt.getTime() + 26 * 60 * 60 * 1000),
          },
        });
        reviewCount += 1;
      }
    }
  }

  // Keep the displayed rating consistent with the reviews that now exist.
  const reviewed = await prisma.review.groupBy({
    by: ['productId'],
    _avg: { rating: true },
    _count: { rating: true },
  });
  for (const group of reviewed) {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: group.productId } });
    const seededCount = product.ratingCount;
    const seededAvg = product.ratingAvg;
    const liveCount = group._count.rating;
    const liveAvg = group._avg.rating ?? 0;
    const total = seededCount + liveCount;
    await prisma.product.update({
      where: { id: group.productId },
      data: {
        ratingCount: total,
        ratingAvg: total ? Number(((seededAvg * seededCount + liveAvg * liveCount) / total).toFixed(2)) : 0,
      },
    });
  }
  console.log(`  ✓ ${reviewCount} verified reviews`);

  // ── a cart in progress for the demo account ──────────────────────────────
  const demoCart = await prisma.cart.findUniqueOrThrow({ where: { userId: primary.id } });
  const cappuccino = allProducts.find((p) => p.slug === 'cappuccino')!;
  const sizeGroup = modifierByKey.get('size')!;
  const milkGroup = modifierByKey.get('milk')!;
  const addonGroup = modifierByKey.get('coffeeAddons')!;
  const sweetGroup = modifierByKey.get('sweetness')!;

  await prisma.cartItem.create({
    data: {
      cartId: demoCart.id,
      productId: cappuccino.id,
      quantity: 2,
      modifiers: {
        create: [
          { modifierOptionId: sizeGroup.options.find((o) => o.name === 'Medium')!.id },
          { modifierOptionId: milkGroup.options.find((o) => o.name === 'Oat Milk')!.id },
          { modifierOptionId: sweetGroup.options.find((o) => o.name === 'No Sugar')!.id },
          { modifierOptionId: addonGroup.options.find((o) => o.name === 'Extra Espresso Shot')!.id },
        ],
      },
    },
  });

  const toast = allProducts.find((p) => p.slug === 'avocado-toast')!;
  const breadGroup = modifierByKey.get('bread')!;
  await prisma.cartItem.create({
    data: {
      cartId: demoCart.id,
      productId: toast.id,
      quantity: 1,
      modifiers: { create: [{ modifierOptionId: breadGroup.options.find((o) => o.name === 'Sourdough')!.id }] },
    },
  });

  // The seed assigns order numbers itself, so the sequence that live checkout
  // draws from must be pushed past the highest seeded number. Without this the
  // first real order after a seed collides with CA-1049 and fails.
  await ensureOrderNumberSequence();
  await prisma.$executeRawUnsafe(
    `SELECT setval('alaap_order_number_seq', ${orderSequence + 1}, false)`,
  );

  const revenue = await prisma.order.aggregate({
    where: { orderStatus: { not: 'CANCELLED' } },
    _sum: { total: true },
  });

  console.log(`
  Seed complete.

  Demo accounts
  ─────────────────────────────────────────────
  Admin     admin@demo-cafe.com    ${DEMO_PASSWORDS.admin}
  Kitchen   kitchen@demo-cafe.com  ${DEMO_PASSWORDS.staff}
  Customer  demo@demo-cafe.com     ${DEMO_PASSWORDS.customer}

  ${productCount} dishes · ${orderTotal} orders · ₹${(revenue._sum.total ?? 0).toLocaleString('en-IN')} lifetime revenue
`);
}

main()
  .catch((error) => {
    console.error('\nSeed failed:\n', error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
