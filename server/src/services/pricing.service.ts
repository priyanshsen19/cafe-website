import type { Coupon, DeliverySpeed, OrderType, SelectionType, Setting } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { clampNonNegative, roundRupees } from '../utils/money';

/**
 * The pricing engine. Every rupee the customer is charged is produced here from
 * database values — the client sends *choices* (product ids, option ids,
 * quantities, a coupon code), never amounts.
 *
 * These functions are intentionally pure so the business rules can be unit
 * tested without a database.
 */

export interface ModifierGroupInput {
  id: string;
  name: string;
  selectionType: SelectionType;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: { id: string; name: string; priceDelta: number; isAvailable: boolean }[];
}

export interface SelectedModifier {
  modifierId: string;
  modifierName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface PricedLine {
  productId: string;
  name: string;
  image: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  modifiers: SelectedModifier[];
  notes?: string | null;
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  taxRatePercent: number;
  freeDeliveryThreshold: number;
  /** How much more the customer needs to spend to unlock free delivery. */
  amountToFreeDelivery: number;
}

/** Unit price = menu price + the sum of the selected option deltas. */
export function unitPriceFor(basePrice: number, selected: { priceDelta: number }[]): number {
  return basePrice + selected.reduce((sum, option) => sum + option.priceDelta, 0);
}

export function lineSubtotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

/**
 * Resolves raw option ids against the product's own modifier groups, enforcing
 * required groups, min/max counts, availability, and that every id actually
 * belongs to this product. Returns the normalised selection with server-side
 * names and price deltas.
 */
export function resolveModifierSelection(
  productName: string,
  groups: ModifierGroupInput[],
  selectedOptionIds: string[],
): SelectedModifier[] {
  const unique = [...new Set(selectedOptionIds)];
  const optionIndex = new Map<string, { group: ModifierGroupInput; option: ModifierGroupInput['options'][number] }>();

  for (const group of groups) {
    for (const option of group.options) optionIndex.set(option.id, { group, option });
  }

  for (const id of unique) {
    if (!optionIndex.has(id)) {
      throw AppError.badRequest(`That customisation isn’t available for ${productName}.`, 'INVALID_MODIFIER');
    }
  }

  const resolved: SelectedModifier[] = [];

  for (const group of groups) {
    const chosen = unique
      .map((id) => optionIndex.get(id))
      .filter((entry): entry is NonNullable<typeof entry> => entry?.group.id === group.id);

    for (const entry of chosen) {
      if (!entry.option.isAvailable) {
        throw AppError.unprocessable(`${entry.option.name} is currently unavailable.`, 'MODIFIER_UNAVAILABLE');
      }
    }

    const max = group.selectionType === 'SINGLE' ? 1 : Math.max(group.maxSelect, 1);
    if (chosen.length > max) {
      throw AppError.badRequest(
        group.selectionType === 'SINGLE'
          ? `Please choose only one ${group.name.toLowerCase()} option.`
          : `You can choose up to ${max} ${group.name.toLowerCase()} options.`,
        'TOO_MANY_MODIFIERS',
      );
    }

    const min = group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect;
    if (chosen.length < min) {
      throw AppError.badRequest(`Please choose a ${group.name.toLowerCase()} option.`, 'MISSING_MODIFIER');
    }

    for (const entry of chosen) {
      resolved.push({
        modifierId: group.id,
        modifierName: group.name,
        optionId: entry.option.id,
        optionName: entry.option.name,
        priceDelta: entry.option.priceDelta,
      });
    }
  }

  return resolved;
}

/** Percentage coupons honour an optional cap; fixed coupons never exceed the bill. */
export function computeCouponDiscount(coupon: Pick<Coupon, 'discountType' | 'discountValue' | 'maxDiscount'>, subtotal: number): number {
  if (coupon.discountType === 'PERCENTAGE') {
    const raw = roundRupees((subtotal * coupon.discountValue) / 100);
    return Math.min(coupon.maxDiscount ?? raw, raw, subtotal);
  }
  return Math.min(coupon.discountValue, subtotal);
}

/**
 * Delivery is only ever charged on DELIVERY orders. Standard delivery is free
 * once the discounted subtotal clears the configured threshold; express is a
 * flat premium that is always charged.
 */
export function computeDeliveryFee(
  orderType: OrderType,
  discountedSubtotal: number,
  settings: Pick<Setting, 'deliveryFee' | 'expressDeliveryFee' | 'freeDeliveryThreshold'>,
  speed: DeliverySpeed = 'STANDARD',
): number {
  if (orderType !== 'DELIVERY') return 0;
  if (speed === 'EXPRESS') return settings.expressDeliveryFee;
  return discountedSubtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee;
}

/**
 * GST is applied to the discounted value of the food and drink. The rate lives
 * in the `settings` table rather than in code so it can be changed without a
 * deploy. This is a configuration hook, not tax advice.
 */
export function computeTax(taxableBase: number, ratePercent: number): number {
  return roundRupees((clampNonNegative(taxableBase) * ratePercent) / 100);
}

export function computeTotals(input: {
  lines: PricedLine[];
  orderType: OrderType;
  settings: Setting;
  coupon?: Pick<Coupon, 'discountType' | 'discountValue' | 'maxDiscount'> | null;
  deliverySpeed?: DeliverySpeed;
}): Totals {
  const { lines, orderType, settings, coupon, deliverySpeed = 'STANDARD' } = input;

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);

  // An empty cart costs nothing at all — without this, a delivery cart with no
  // items would still display a delivery fee as its total.
  if (subtotal === 0) {
    return {
      subtotal: 0,
      discount: 0,
      tax: 0,
      deliveryFee: 0,
      total: 0,
      taxRatePercent: settings.taxRatePercent,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      amountToFreeDelivery: 0,
    };
  }

  const discount = coupon ? computeCouponDiscount(coupon, subtotal) : 0;
  const discountedSubtotal = clampNonNegative(subtotal - discount);

  const deliveryFee = computeDeliveryFee(orderType, discountedSubtotal, settings, deliverySpeed);
  const tax = computeTax(discountedSubtotal, settings.taxRatePercent);
  const packaging = orderType === 'DINE_IN' ? 0 : settings.packagingFee;
  const total = discountedSubtotal + tax + deliveryFee + packaging;

  const amountToFreeDelivery =
    orderType === 'DELIVERY' && deliverySpeed === 'STANDARD'
      ? clampNonNegative(settings.freeDeliveryThreshold - discountedSubtotal)
      : 0;

  return {
    subtotal,
    discount,
    tax,
    deliveryFee,
    total,
    taxRatePercent: settings.taxRatePercent,
    freeDeliveryThreshold: settings.freeDeliveryThreshold,
    amountToFreeDelivery,
  };
}

/** Human-readable modifier line for cards and receipts: "Medium · Oat Milk". */
export function describeModifiers(modifiers: SelectedModifier[]): string {
  return modifiers.map((m) => m.optionName).join(' · ');
}
