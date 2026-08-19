import type { Cart, DeliverySpeed, OrderType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { productDetailInclude, toModifierGroups } from '../repositories/product.repository';
import {
  computeTotals,
  describeModifiers,
  lineSubtotal,
  resolveModifierSelection,
  unitPriceFor,
  type PricedLine,
  type SelectedModifier,
  type Totals,
} from './pricing.service';
import { getSettings } from './settings.service';
import { validateCoupon } from './coupon.service';

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: { include: productDetailInclude },
      modifiers: { include: { modifierOption: { include: { modifier: true } } } },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export interface CartLine extends PricedLine {
  id: string;
  slug: string;
  isAvailable: boolean;
  modifierSummary: string;
}

export interface CartView {
  id: string;
  lines: CartLine[];
  itemCount: number;
  totals: Totals;
  /** Items the customer added that the kitchen has since taken off the menu. */
  unavailableLines: CartLine[];
  coupon: { code: string; description: string; discount: number } | null;
}

export interface CartOwner {
  userId?: string;
  sessionId?: string;
}

function ownerWhere(owner: CartOwner): Prisma.CartWhereInput {
  if (owner.userId) return { userId: owner.userId };
  if (owner.sessionId) return { sessionId: owner.sessionId };
  throw AppError.badRequest('A cart session is required.', 'NO_CART_SESSION');
}

/** Signed-in customers get their user cart; guests get a cookie-scoped cart. */
export async function getOrCreateCart(owner: CartOwner): Promise<Cart> {
  const existing = await prisma.cart.findFirst({ where: ownerWhere(owner) });
  if (existing) return existing;

  return prisma.cart.create({
    data: owner.userId ? { userId: owner.userId } : { sessionId: owner.sessionId! },
  });
}

async function loadCart(owner: CartOwner): Promise<CartWithItems | null> {
  return prisma.cart.findFirst({ where: ownerWhere(owner), include: cartInclude });
}

/**
 * Re-prices the cart from live product data on every read, so a menu price
 * change is reflected immediately and a stale client can never pin an old price.
 */
function priceCart(cart: CartWithItems): { lines: CartLine[]; unavailable: CartLine[] } {
  const lines: CartLine[] = [];
  const unavailable: CartLine[] = [];

  for (const item of cart.items) {
    const modifiers: SelectedModifier[] = item.modifiers.map((link) => ({
      modifierId: link.modifierOption.modifierId,
      modifierName: link.modifierOption.modifier.name,
      optionId: link.modifierOption.id,
      optionName: link.modifierOption.name,
      priceDelta: link.modifierOption.priceDelta,
    }));

    const unitPrice = unitPriceFor(item.product.basePrice, modifiers);
    const line: CartLine = {
      id: item.id,
      productId: item.productId,
      slug: item.product.slug,
      name: item.product.name,
      image: item.product.imageUrl,
      basePrice: item.product.basePrice,
      unitPrice,
      quantity: item.quantity,
      subtotal: lineSubtotal(unitPrice, item.quantity),
      modifiers,
      modifierSummary: describeModifiers(modifiers),
      notes: item.notes,
      isAvailable: item.product.isAvailable,
    };

    if (item.product.isAvailable) lines.push(line);
    else unavailable.push(line);
  }

  return { lines, unavailable };
}

export async function getCartView(
  owner: CartOwner,
  options: { orderType?: OrderType; couponCode?: string | null; deliverySpeed?: DeliverySpeed } = {},
): Promise<CartView> {
  const cart = await loadCart(owner);
  const settings = await getSettings();
  const orderType = options.orderType ?? 'DELIVERY';

  if (!cart) {
    const empty = await getOrCreateCart(owner);
    return {
      id: empty.id,
      lines: [],
      unavailableLines: [],
      itemCount: 0,
      coupon: null,
      totals: computeTotals({ lines: [], orderType, settings }),
    };
  }

  const { lines, unavailable } = priceCart(cart);
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);

  let coupon = null as CartView['coupon'];
  let couponRecord = null as Awaited<ReturnType<typeof validateCoupon>> | null;

  if (options.couponCode && owner.userId) {
    // A coupon that no longer applies simply drops off rather than blocking the cart.
    couponRecord = await validateCoupon(options.couponCode, subtotal, owner.userId).catch(() => null);
  }

  const totals = computeTotals({
    lines,
    orderType,
    settings,
    coupon: couponRecord,
    deliverySpeed: options.deliverySpeed,
  });

  if (couponRecord) {
    coupon = { code: couponRecord.code, description: couponRecord.description, discount: totals.discount };
  }

  return {
    id: cart.id,
    lines,
    unavailableLines: unavailable,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    coupon,
    totals,
  };
}

export async function addItem(
  owner: CartOwner,
  input: { productId: string; quantity: number; modifierOptionIds: string[]; notes?: string },
): Promise<CartView> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: productDetailInclude,
  });

  if (!product) throw AppError.notFound('That dish is no longer on our menu.', 'PRODUCT_NOT_FOUND');
  if (!product.isAvailable) {
    throw AppError.unprocessable('This dish is currently unavailable.', 'PRODUCT_UNAVAILABLE');
  }

  // Validated server-side: required groups, limits, availability, ownership.
  const selection = resolveModifierSelection(product.name, toModifierGroups(product), input.modifierOptionIds);
  const cart = await getOrCreateCart(owner);
  const selectedIds = [...selection.map((s) => s.optionId)].sort();

  // Adding the same dish with an identical customisation bumps quantity rather
  // than creating a second, confusing line.
  const siblings = await prisma.cartItem.findMany({
    where: { cartId: cart.id, productId: product.id, notes: input.notes ?? null },
    include: { modifiers: true },
  });

  const twin = siblings.find((item) => {
    const ids = item.modifiers.map((m) => m.modifierOptionId).sort();
    return ids.length === selectedIds.length && ids.every((id, index) => id === selectedIds[index]);
  });

  if (twin) {
    await prisma.cartItem.update({
      where: { id: twin.id },
      data: { quantity: Math.min(twin.quantity + input.quantity, 30) },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: input.quantity,
        notes: input.notes ?? null,
        modifiers: { create: selectedIds.map((id) => ({ modifierOptionId: id })) },
      },
    });
  }

  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  return getCartView(owner);
}

export async function updateItem(owner: CartOwner, itemId: string, quantity: number): Promise<CartView> {
  const cart = await getOrCreateCart(owner);
  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });

  // Ownership check — an item id from another cart must not be mutable.
  if (!item || item.cartId !== cart.id) throw AppError.notFound('That item isn’t in your cart.', 'ITEM_NOT_FOUND');

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: Math.min(quantity, 30) } });
  }

  return getCartView(owner);
}

export async function removeItem(owner: CartOwner, itemId: string): Promise<CartView> {
  const cart = await getOrCreateCart(owner);
  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cart.id) throw AppError.notFound('That item isn’t in your cart.', 'ITEM_NOT_FOUND');

  await prisma.cartItem.delete({ where: { id: itemId } });
  return getCartView(owner);
}

export async function clearCart(owner: CartOwner): Promise<CartView> {
  const cart = await getOrCreateCart(owner);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCartView(owner);
}

/**
 * Moves a guest cart's contents into the customer's cart at sign-in, then
 * discards the guest cart. Quantities are added together for identical lines.
 */
export async function mergeGuestCart(sessionId: string, userId: string): Promise<void> {
  const guestCart = await prisma.cart.findUnique({
    where: { sessionId },
    include: { items: { include: { modifiers: true } } },
  });

  if (!guestCart || guestCart.items.length === 0) {
    if (guestCart) await prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
    return;
  }

  const userCart = await getOrCreateCart({ userId });

  for (const item of guestCart.items) {
    const optionIds = item.modifiers.map((m) => m.modifierOptionId).sort();
    const siblings = await prisma.cartItem.findMany({
      where: { cartId: userCart.id, productId: item.productId, notes: item.notes },
      include: { modifiers: true },
    });

    const twin = siblings.find((candidate) => {
      const ids = candidate.modifiers.map((m) => m.modifierOptionId).sort();
      return ids.length === optionIds.length && ids.every((id, index) => id === optionIds[index]);
    });

    if (twin) {
      await prisma.cartItem.update({
        where: { id: twin.id },
        data: { quantity: Math.min(twin.quantity + item.quantity, 30) },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: userCart.id,
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes,
          modifiers: { create: optionIds.map((id) => ({ modifierOptionId: id })) },
        },
      });
    }
  }

  await prisma.cart.delete({ where: { id: guestCart.id } });
}
