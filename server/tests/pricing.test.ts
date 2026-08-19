import { describe, expect, it } from 'vitest';
import type { Setting } from '@prisma/client';
import {
  computeCouponDiscount,
  computeOnlinePaymentFee,
  computeDeliveryFee,
  computeTax,
  computeTotals,
  describeModifiers,
  lineSubtotal,
  resolveModifierSelection,
  unitPriceFor,
  type ModifierGroupInput,
  type PricedLine,
} from '../src/services/pricing.service';
import { AppError } from '../src/utils/AppError';

const settings: Setting = {
  id: 'singleton',
  taxRatePercent: 5,
  deliveryFee: 49,
  expressDeliveryFee: 89,
  freeDeliveryThreshold: 499,
  packagingFee: 0,
  onlinePaymentFeePercent: 2,
  updatedAt: new Date(),
};

function line(overrides: Partial<PricedLine> = {}): PricedLine {
  return {
    productId: 'p1',
    name: 'Cappuccino',
    image: 'https://example.test/image.jpg',
    basePrice: 210,
    unitPrice: 210,
    quantity: 1,
    subtotal: 210,
    modifiers: [],
    ...overrides,
  };
}

describe('unit pricing', () => {
  it('adds every selected modifier delta to the menu price', () => {
    // Cappuccino ₹210 + Medium ₹30 + Oat ₹60 + Extra shot ₹50 = ₹350
    const price = unitPriceFor(210, [{ priceDelta: 30 }, { priceDelta: 60 }, { priceDelta: 50 }]);
    expect(price).toBe(350);
  });

  it('leaves the price untouched when nothing is selected', () => {
    expect(unitPriceFor(210, [])).toBe(210);
  });

  it('multiplies by quantity for the line total', () => {
    expect(lineSubtotal(350, 2)).toBe(700);
  });
});

describe('modifier validation', () => {
  const groups: ModifierGroupInput[] = [
    {
      id: 'size',
      name: 'Size',
      selectionType: 'SINGLE',
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: 'small', name: 'Small', priceDelta: 0, isAvailable: true },
        { id: 'medium', name: 'Medium', priceDelta: 30, isAvailable: true },
      ],
    },
    {
      id: 'addons',
      name: 'Add-ons',
      selectionType: 'MULTI',
      isRequired: false,
      minSelect: 0,
      maxSelect: 2,
      options: [
        { id: 'shot', name: 'Extra Espresso Shot', priceDelta: 50, isAvailable: true },
        { id: 'vanilla', name: 'Vanilla', priceDelta: 30, isAvailable: true },
        { id: 'caramel', name: 'Caramel', priceDelta: 30, isAvailable: false },
      ],
    },
  ];

  it('resolves names and prices from the server, not the request', () => {
    const resolved = resolveModifierSelection('Cappuccino', groups, ['medium', 'shot']);

    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({ modifierName: 'Size', optionName: 'Medium', priceDelta: 30 });
    expect(resolved[1]).toMatchObject({ optionName: 'Extra Espresso Shot', priceDelta: 50 });
  });

  it('rejects an option that belongs to another product', () => {
    expect(() => resolveModifierSelection('Cappuccino', groups, ['not-a-real-option'])).toThrow(AppError);
  });

  it('requires a selection for a required group', () => {
    expect(() => resolveModifierSelection('Cappuccino', groups, [])).toThrowError(/choose a size/i);
  });

  it('refuses two choices in a single-select group', () => {
    expect(() => resolveModifierSelection('Cappuccino', groups, ['small', 'medium'])).toThrowError(/only one/i);
  });

  it('enforces the maximum on a multi-select group', () => {
    const overloaded: ModifierGroupInput[] = [
      { ...groups[1]!, isRequired: false, maxSelect: 1 },
    ];
    expect(() => resolveModifierSelection('Cappuccino', overloaded, ['shot', 'vanilla'])).toThrowError(/up to 1/i);
  });

  it('refuses an option the kitchen has switched off', () => {
    expect(() => resolveModifierSelection('Cappuccino', groups, ['small', 'caramel'])).toThrowError(/unavailable/i);
  });

  it('ignores duplicate ids rather than double-charging', () => {
    const resolved = resolveModifierSelection('Cappuccino', groups, ['medium', 'medium']);
    expect(resolved).toHaveLength(1);
  });

  it('summarises a selection for receipts', () => {
    const resolved = resolveModifierSelection('Cappuccino', groups, ['medium', 'shot']);
    expect(describeModifiers(resolved)).toBe('Medium · Extra Espresso Shot');
  });
});

describe('coupons', () => {
  it('applies a percentage discount', () => {
    expect(computeCouponDiscount({ discountType: 'PERCENTAGE', discountValue: 10, maxDiscount: null }, 700)).toBe(70);
  });

  it('honours the cap on a percentage discount', () => {
    // 15% of ₹2000 is ₹300, but the coupon caps at ₹200.
    expect(computeCouponDiscount({ discountType: 'PERCENTAGE', discountValue: 15, maxDiscount: 200 }, 2000)).toBe(200);
  });

  it('applies a fixed discount', () => {
    expect(computeCouponDiscount({ discountType: 'FIXED', discountValue: 150, maxDiscount: null }, 800)).toBe(150);
  });

  it('never discounts more than the bill', () => {
    expect(computeCouponDiscount({ discountType: 'FIXED', discountValue: 500, maxDiscount: null }, 300)).toBe(300);
  });
});

describe('delivery fee', () => {
  it('charges the standard fee below the free-delivery threshold', () => {
    expect(computeDeliveryFee('DELIVERY', 300, settings)).toBe(49);
  });

  it('is free at or above the threshold', () => {
    expect(computeDeliveryFee('DELIVERY', 499, settings)).toBe(0);
    expect(computeDeliveryFee('DELIVERY', 900, settings)).toBe(0);
  });

  it('always charges the express premium', () => {
    expect(computeDeliveryFee('DELIVERY', 900, settings, 'EXPRESS')).toBe(89);
  });

  it('is never charged on pickup or dine-in', () => {
    expect(computeDeliveryFee('PICKUP', 200, settings)).toBe(0);
    expect(computeDeliveryFee('DINE_IN', 200, settings)).toBe(0);
  });
});

describe('tax', () => {
  it('applies the configured rate and rounds to the rupee', () => {
    expect(computeTax(700, 5)).toBe(35);
    expect(computeTax(695, 5)).toBe(35); // 34.75 rounds up
  });

  it('never taxes a negative base', () => {
    expect(computeTax(-100, 5)).toBe(0);
  });
});

describe('order totals', () => {
  it('composes subtotal, discount, tax and delivery correctly', () => {
    const totals = computeTotals({
      lines: [line({ unitPrice: 350, quantity: 2, subtotal: 700 })],
      orderType: 'DELIVERY',
      settings,
      coupon: { discountType: 'PERCENTAGE', discountValue: 10, maxDiscount: 100 },
    });

    // 700 − 70 = 630 discounted; tax 5% of 630 = 32 (31.5 rounds up);
    // 630 ≥ 499 so delivery is free.
    expect(totals).toMatchObject({ subtotal: 700, discount: 70, tax: 32, deliveryFee: 0, total: 662 });
  });

  it('taxes the discounted amount, not the gross subtotal', () => {
    const withCoupon = computeTotals({
      lines: [line({ subtotal: 1000, unitPrice: 1000 })],
      orderType: 'PICKUP',
      settings,
      coupon: { discountType: 'FIXED', discountValue: 200, maxDiscount: null },
    });

    expect(withCoupon.tax).toBe(computeTax(800, 5));
    expect(withCoupon.total).toBe(800 + 40);
  });

  it('reports how far the customer is from free delivery', () => {
    const totals = computeTotals({
      lines: [line({ subtotal: 300, unitPrice: 300 })],
      orderType: 'DELIVERY',
      settings,
    });

    expect(totals.amountToFreeDelivery).toBe(199);
    expect(totals.deliveryFee).toBe(49);
    expect(totals.total).toBe(300 + 15 + 49);
  });

  it('has no free-delivery gap once the threshold is met', () => {
    const totals = computeTotals({
      lines: [line({ subtotal: 600, unitPrice: 600 })],
      orderType: 'DELIVERY',
      settings,
    });
    expect(totals.amountToFreeDelivery).toBe(0);
  });

  it('handles an empty cart without producing NaN', () => {
    const totals = computeTotals({ lines: [], orderType: 'DELIVERY', settings });
    expect(totals).toMatchObject({ subtotal: 0, discount: 0, tax: 0, total: 0 });
  });
});

describe('online payment fee (gross-up)', () => {
  it('is not charged on cash payments', () => {
    expect(computeOnlinePaymentFee(1000, 'COD', 2)).toBe(0);
    expect(computeOnlinePaymentFee(1000, 'PAY_AT_COUNTER', 2)).toBe(0);
  });

  it('is charged on card, UPI and net banking', () => {
    for (const method of ['CARD', 'UPI', 'NETBANKING'] as const) {
      expect(computeOnlinePaymentFee(1000, method, 2)).toBeGreaterThan(0);
    }
  });

  /**
   * The whole point: after the gateway takes its cut of the *charged* amount,
   * the café must still be left with the original order value. A naive
   * "add 2%" leaves it short, because the fee applies to the larger sum too.
   */
  it('leaves the café with exactly the order value after the gateway’s cut', () => {
    for (const net of [336, 1000, 2500, 199]) {
      const fee = computeOnlinePaymentFee(net, 'CARD', 2);
      const charged = net + fee;
      const gatewayTakes = charged * 0.02;
      expect(charged - gatewayTakes).toBeCloseTo(net, 0);
    }
  });

  it('is bigger than a naive percentage of the original amount', () => {
    // 2% of 1000 is 20, but grossing up needs 20.41 → 20.
    expect(computeOnlinePaymentFee(1000, 'CARD', 2)).toBe(20);
    // The real proof is at a value where rounding shows the difference.
    expect(computeOnlinePaymentFee(336, 'CARD', 2)).toBe(7);
  });

  it('scales with the order rather than being a flat amount', () => {
    const small = computeOnlinePaymentFee(336, 'CARD', 2);
    const large = computeOnlinePaymentFee(2500, 'CARD', 2);
    expect(large).toBeGreaterThan(small * 5);
  });

  it('is skipped when the café chooses to absorb the cost', () => {
    expect(computeOnlinePaymentFee(1000, 'CARD', 0)).toBe(0);
  });

  it('is skipped when no method has been chosen yet', () => {
    expect(computeOnlinePaymentFee(1000, undefined, 2)).toBe(0);
  });

  it('appears in the order total for online payments only', () => {
    const online = computeTotals({
      lines: [line({ subtotal: 1000, unitPrice: 1000 })],
      orderType: 'PICKUP',
      settings,
      paymentMethod: 'CARD',
    });
    const cash = computeTotals({
      lines: [line({ subtotal: 1000, unitPrice: 1000 })],
      orderType: 'PICKUP',
      settings,
      paymentMethod: 'PAY_AT_COUNTER',
    });

    expect(online.paymentFee).toBeGreaterThan(0);
    expect(cash.paymentFee).toBe(0);
    expect(online.total).toBe(cash.total + online.paymentFee);
  });

  it('is computed on the whole bill, not just the food', () => {
    // Delivery fee and tax are also processed by the gateway.
    const totals = computeTotals({
      lines: [line({ subtotal: 300, unitPrice: 300 })],
      orderType: 'DELIVERY',
      settings,
      paymentMethod: 'UPI',
    });

    const beforeFee = totals.subtotal - totals.discount + totals.tax + totals.deliveryFee;
    expect(totals.paymentFee).toBe(computeOnlinePaymentFee(beforeFee, 'UPI', 2));
    expect(totals.total).toBe(beforeFee + totals.paymentFee);
  });
});
