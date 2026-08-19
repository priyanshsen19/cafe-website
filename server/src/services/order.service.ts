import type {
  DeliverySpeed,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Prisma,
  Role,
} from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { nextOrderNumber } from '../utils/orderNumber';
import { evaluateOpenState } from '../utils/hours';
import {
  ORDER_FLOW,
  canTransition,
  eventForStatus,
  isActive,
  statusLabel,
  STATUS_DESCRIPTION,
} from '../utils/orderFlow';
import { emitOrderEvent } from '../sockets';
import { getSettings } from './settings.service';
import { recordUsage, validateCoupon } from './coupon.service';
import { computeTotals, describeModifiers, unitPriceFor, type PricedLine } from './pricing.service';
import * as cartService from './cart.service';
import { refundCancelledOrder } from './refund.service';

/** Which payment methods make sense for each fulfilment type. */
export const ALLOWED_PAYMENT_METHODS: Record<OrderType, PaymentMethod[]> = {
  DELIVERY: ['UPI', 'CARD', 'NETBANKING', 'COD'],
  PICKUP: ['UPI', 'CARD', 'NETBANKING', 'PAY_AT_COUNTER'],
  DINE_IN: ['UPI', 'CARD', 'NETBANKING', 'PAY_AT_COUNTER'],
};

export const orderDetailInclude = {
  items: { include: { modifiers: true }, orderBy: { id: 'asc' } },
  deliveryAddress: true,
  cafe: { select: { id: true, name: true, slug: true, line1: true, city: true, phone: true } },
  table: { select: { id: true, label: true, floor: true } },
  payments: { orderBy: { createdAt: 'desc' } },
  refunds: {
    orderBy: { createdAt: 'desc' },
    include: { issuedBy: { select: { id: true, name: true } } },
  },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export interface CreateOrderInput {
  orderType: OrderType;
  addressId?: string;
  cafeId?: string;
  tableToken?: string;
  scheduledFor?: string;
  deliverySpeed?: DeliverySpeed;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  notes?: string;
  contactName?: string;
  contactPhone?: string;
}

/**
 * Resolves where an order is going, validating that the customer actually owns
 * the address and that the branch or table exists.
 */
async function resolveDestination(userId: string, input: CreateOrderInput) {
  if (input.orderType === 'DELIVERY') {
    if (!input.addressId) throw AppError.badRequest('Choose a delivery address.', 'ADDRESS_REQUIRED');

    const address = await prisma.address.findFirst({ where: { id: input.addressId, userId } });
    if (!address) throw AppError.notFound('We couldn’t find that address on your account.', 'ADDRESS_NOT_FOUND');

    // Delivery is dispatched from a branch in the same city where possible.
    const cafe =
      (input.cafeId ? await prisma.cafe.findFirst({ where: { id: input.cafeId, isActive: true } }) : null) ??
      (await prisma.cafe.findFirst({
        where: { isActive: true, supportsDelivery: true, city: address.city },
        orderBy: { sortOrder: 'asc' },
      })) ??
      (await prisma.cafe.findFirst({ where: { isActive: true, supportsDelivery: true }, orderBy: { sortOrder: 'asc' } }));

    if (!cafe) throw AppError.unprocessable('We don’t deliver to that area yet.', 'NO_DELIVERY_COVERAGE');
    return { cafe, address, table: null };
  }

  if (input.orderType === 'PICKUP') {
    if (!input.cafeId) throw AppError.badRequest('Choose a pickup location.', 'CAFE_REQUIRED');
    const cafe = await prisma.cafe.findFirst({ where: { id: input.cafeId, isActive: true } });
    if (!cafe) throw AppError.notFound('That location isn’t available.', 'CAFE_NOT_FOUND');
    return { cafe, address: null, table: null };
  }

  // DINE_IN — the table comes from the QR token printed on the table itself.
  if (!input.tableToken) throw AppError.badRequest('Scan the QR code on your table to order.', 'TABLE_REQUIRED');

  const table = await prisma.cafeTable.findFirst({
    where: { qrToken: input.tableToken, isActive: true },
    include: { cafe: true },
  });
  if (!table || !table.cafe.isActive) throw AppError.notFound('That table code isn’t valid.', 'TABLE_NOT_FOUND');

  return { cafe: table.cafe, address: null, table };
}

/**
 * Café hours gate walk-up ordering. A closed café can still take a *scheduled*
 * order, as long as the requested slot falls inside opening hours.
 */
async function assertOrderable(cafeId: string, scheduledFor?: Date) {
  const hours = await prisma.operatingHour.findMany({ where: { cafeId } });
  const state = evaluateOpenState(hours, scheduledFor ?? new Date());

  if (state.isOpen) return;

  if (!scheduledFor) {
    throw AppError.unprocessable(
      state.message ? `We’re currently closed. ${state.message}` : 'We’re currently closed.',
      'CAFE_CLOSED',
    );
  }

  throw AppError.unprocessable('We’re closed at that time. Please pick another slot.', 'OUTSIDE_HOURS');
}

export async function createOrder(userId: string, input: CreateOrderInput): Promise<OrderDetail> {
  const customer = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!ALLOWED_PAYMENT_METHODS[input.orderType].includes(input.paymentMethod)) {
    throw AppError.badRequest('That payment method isn’t available for this order type.', 'PAYMENT_METHOD_INVALID');
  }

  const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : undefined;
  if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
    throw AppError.badRequest('That scheduled time isn’t valid.', 'SCHEDULE_INVALID');
  }
  if (scheduledFor && scheduledFor.getTime() < Date.now() - 60_000) {
    throw AppError.badRequest('Choose a time in the future.', 'SCHEDULE_PAST');
  }

  const { cafe, address, table } = await resolveDestination(userId, input);
  await assertOrderable(cafe.id, scheduledFor);

  // Re-read the cart from the database and re-price it. Nothing about money
  // comes from the request.
  const cart = await cartService.getCartView(
    { userId },
    { orderType: input.orderType, paymentMethod: input.paymentMethod },
  );

  // Unavailable items are reported before emptiness: a cart holding only
  // sold-out dishes has zero orderable lines, and "your cart is empty" would be
  // a confusing way to say "the thing you chose just ran out".
  if (cart.unavailableLines.length > 0) {
    throw AppError.unprocessable(
      `${cart.unavailableLines[0]!.name} is currently unavailable. Please remove it to continue.`,
      'ITEM_UNAVAILABLE',
      { items: cart.unavailableLines.map((line) => line.name) },
    );
  }
  if (cart.lines.length === 0) {
    throw AppError.badRequest('Your cart is empty.', 'CART_EMPTY');
  }

  const settings = await getSettings();
  const coupon = input.couponCode
    ? await validateCoupon(input.couponCode, cart.totals.subtotal, userId)
    : null;

  const lines: PricedLine[] = cart.lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    image: line.image,
    basePrice: line.basePrice,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    subtotal: line.subtotal,
    modifiers: line.modifiers,
    notes: line.notes,
  }));

  const totals = computeTotals({
    lines,
    orderType: input.orderType,
    settings,
    coupon,
    deliverySpeed: input.deliverySpeed,
    paymentMethod: input.paymentMethod,
  });

  // Promised ready time: a base turnaround plus a little per additional item.
  const prepMinutes = 15 + Math.min(lines.length * 2, 20);
  const orderNumber = await nextOrderNumber();

  // COD and pay-at-counter are confirmed immediately; online payments stay
  // PENDING until the gateway signature is verified.
  const isCashLike = input.paymentMethod === 'COD' || input.paymentMethod === 'PAY_AT_COUNTER';

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId,
        orderType: input.orderType,
        cafeId: cafe.id,
        tableId: table?.id,
        scheduledFor,
        deliverySpeed: input.orderType === 'DELIVERY' ? (input.deliverySpeed ?? 'STANDARD') : null,
        contactName: input.contactName?.trim() || customer.name,
        contactPhone: input.contactPhone?.trim() || customer.phone,
        notes: input.notes?.trim() || null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        deliveryFee: totals.deliveryFee,
        paymentFee: totals.paymentFee,
        total: totals.total,
        couponId: coupon?.id,
        couponCode: coupon?.code,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'PENDING',
        // Cash orders are real the moment they're placed — the money arrives at
        // handover. Card/UPI orders are not: until the gateway confirms, this
        // is only an intent to order, so it stays out of the kitchen and out of
        // revenue until payment is verified.
        orderStatus: isCashLike ? 'PLACED' : 'AWAITING_PAYMENT',
        estimatedReadyAt: new Date((scheduledFor ?? new Date()).getTime() + prepMinutes * 60_000),
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            productNameSnapshot: line.name,
            productImageSnapshot: line.image,
            unitPriceSnapshot: line.unitPrice,
            quantity: line.quantity,
            subtotal: line.subtotal,
            notes: line.notes ?? null,
            customizationSnapshot: (line.modifiers.length
              ? {
                  summary: describeModifiers(line.modifiers),
                  options: line.modifiers.map((m) => ({
                    group: m.modifierName,
                    option: m.optionName,
                    priceDelta: m.priceDelta,
                  })),
                }
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
          create: {
            status: isCashLike ? 'PLACED' : 'AWAITING_PAYMENT',
            note: isCashLike ? 'Order received' : 'Waiting for payment',
          },
        },
        payments: {
          create: {
            provider: isCashLike ? 'CASH' : 'RAZORPAY',
            amount: totals.total,
            method: input.paymentMethod,
            status: 'PENDING',
          },
        },
        ...(address
          ? {
              deliveryAddress: {
                create: {
                  fullName: address.fullName,
                  phone: address.phone,
                  line1: address.line1,
                  line2: address.line2,
                  city: address.city,
                  state: address.state,
                  postalCode: address.postalCode,
                  country: address.country,
                  instructions: address.instructions,
                },
              },
            }
          : {}),
      },
      include: orderDetailInclude,
    });

    if (coupon) {
      await recordUsage(tx, {
        couponId: coupon.id,
        userId,
        orderId: created.id,
        discountAmount: totals.discount,
      });
    }

    for (const line of lines) {
      await tx.product.update({
        where: { id: line.productId },
        data: { orderCount: { increment: line.quantity } },
      });
    }

    if (table) {
      await tx.cafeTable.update({ where: { id: table.id }, data: { status: 'OCCUPIED' } });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  // Only announce orders the kitchen should actually see. An unpaid order is
  // broadcast to nobody until its payment clears.
  if (order.orderStatus === 'PLACED') {
    emitOrderEvent('order:created', order, toOrderSummary(order));
  }

  return order;
}

// ─────────────────────────────────────────────────────────────── reading

export async function getOrderForViewer(
  orderId: string,
  viewer: { id: string; role: Role },
): Promise<OrderDetail> {
  // Accept either the internal id or the human order number.
  const order = await prisma.order.findFirst({
    where: { OR: [{ id: orderId }, { orderNumber: orderId.toUpperCase() }] },
    include: orderDetailInclude,
  });

  if (!order) throw AppError.notFound('We couldn’t find that order.', 'ORDER_NOT_FOUND');

  const isStaff = viewer.role === 'ADMIN' || viewer.role === 'STAFF';
  if (!isStaff && order.userId !== viewer.id) {
    // Deliberately a 404 rather than a 403 — an outsider shouldn't learn the
    // order exists at all.
    throw AppError.notFound('We couldn’t find that order.', 'ORDER_NOT_FOUND');
  }

  return order;
}

export async function listOrdersForUser(
  userId: string,
  filter: 'all' | 'active' | 'completed' | 'cancelled' = 'all',
) {
  const where: Prisma.OrderWhereInput = { userId };

  if (filter === 'active') where.orderStatus = { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] };
  if (filter === 'completed') where.orderStatus = { in: ['DELIVERED', 'COLLECTED', 'SERVED'] };
  if (filter === 'cancelled') where.orderStatus = 'CANCELLED';

  const orders = await prisma.order.findMany({
    where,
    include: orderDetailInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return orders.map(toOrderSummary);
}

export function toOrderSummary(order: OrderDetail) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    orderStatus: order.orderStatus,
    statusLabel: statusLabel(order.orderStatus, order.orderType),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    deliveryFee: order.deliveryFee,
    paymentFee: order.paymentFee,
    total: order.total,
    couponCode: order.couponCode,
    notes: order.notes,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    scheduledFor: order.scheduledFor,
    estimatedReadyAt: order.estimatedReadyAt,
    createdAt: order.createdAt,
    isActive: isActive(order.orderStatus),
    cafe: order.cafe,
    table: order.table,
    deliveryAddress: order.deliveryAddress,
    customer: order.user,
    // Money returned so far, and each refund with its own state — a refund can
    // still be in flight or have failed at the gateway.
    refundedAmount: order.refunds
      .filter((refund) => refund.status !== 'FAILED')
      .reduce((sum, refund) => sum + refund.amount, 0),
    refunds: order.refunds.map((refund) => ({
      id: refund.id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      failureReason: refund.failureReason,
      issuedBy: refund.issuedBy?.name ?? null,
      createdAt: refund.createdAt,
    })),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.productNameSnapshot,
      image: item.productImageSnapshot,
      unitPrice: item.unitPriceSnapshot,
      quantity: item.quantity,
      subtotal: item.subtotal,
      notes: item.notes,
      modifierSummary: item.modifiers.map((m) => m.optionNameSnapshot).join(' · '),
      modifiers: item.modifiers.map((m) => ({
        group: m.modifierNameSnapshot,
        option: m.optionNameSnapshot,
        priceDelta: m.priceDeltaSnapshot,
      })),
    })),
  };
}

/** The tracking timeline: every step of this order type, with what's done. */
export function buildTracking(order: OrderDetail) {
  const historyByStatus = new Map(order.statusHistory.map((entry) => [entry.status, entry]));

  /**
   * An unpaid order has no fulfilment progress to show — nothing has been sent
   * to the kitchen. Showing the normal timeline with every step grey would
   * imply the café is working on it. Instead the timeline is replaced by the
   * one step that actually matters: paying.
   */
  if (order.orderStatus === 'AWAITING_PAYMENT') {
    const entry = historyByStatus.get('AWAITING_PAYMENT');
    return {
      order: toOrderSummary(order),
      isCancelled: false,
      cancelledReason: null,
      awaitingPayment: true,
      steps: [
        {
          status: 'AWAITING_PAYMENT' as const,
          label: 'Awaiting payment',
          description:
            'Your order is held for you but hasn’t been sent to the kitchen yet. Complete payment to confirm it.',
          at: entry?.createdAt ?? order.createdAt,
          isComplete: false,
          isCurrent: true,
        },
      ],
    };
  }

  const flow = ORDER_FLOW[order.orderType];
  const currentIndex = flow.indexOf(order.orderStatus);

  const steps = flow.map((status, index) => {
    const entry = historyByStatus.get(status);
    return {
      status,
      label: statusLabel(status, order.orderType),
      description: STATUS_DESCRIPTION[status],
      at: entry?.createdAt ?? null,
      isComplete: order.orderStatus === 'CANCELLED' ? Boolean(entry) : index <= currentIndex,
      isCurrent: order.orderStatus !== 'CANCELLED' && index === currentIndex,
    };
  });

  return {
    order: toOrderSummary(order),
    isCancelled: order.orderStatus === 'CANCELLED',
    cancelledReason: order.cancelledReason,
    awaitingPayment: false,
    steps,
  };
}

// ─────────────────────────────────────────────────────────────── writing

export async function updateStatus(
  orderId: string,
  status: OrderStatus,
  options: { note?: string; actorRole: Role } = { actorRole: 'STAFF' },
): Promise<OrderDetail> {
  const existing = await prisma.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
  if (!existing) throw AppError.notFound('We couldn’t find that order.', 'ORDER_NOT_FOUND');

  if (!canTransition(existing.orderType, existing.orderStatus, status)) {
    throw AppError.badRequest(
      `An order that is ${statusLabel(existing.orderStatus, existing.orderType).toLowerCase()} can’t move to ${statusLabel(status, existing.orderType).toLowerCase()}.`,
      'INVALID_TRANSITION',
    );
  }

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: status,
        cancelledReason: status === 'CANCELLED' ? (options.note ?? 'Cancelled by café') : undefined,
        // Cash is collected on handover, so the bill settles at the terminal step.
        paymentStatus:
          !isActive(status) &&
          status !== 'CANCELLED' &&
          (existing.paymentMethod === 'COD' || existing.paymentMethod === 'PAY_AT_COUNTER')
            ? 'SUCCESS'
            : undefined,
        statusHistory: { create: { status, note: options.note } },
      },
      include: orderDetailInclude,
    });

    // Free the table once the party's order is done.
    if (updated.tableId && !isActive(status)) {
      const otherActive = await tx.order.count({
        where: {
          tableId: updated.tableId,
          id: { not: updated.id },
          orderStatus: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'] },
        },
      });
      if (otherActive === 0) {
        await tx.cafeTable.update({ where: { id: updated.tableId }, data: { status: 'CLEANING' } });
      }
    }

    return updated;
  });

  // A customer who already paid shouldn't have to chase their money — cancelling
  // returns it automatically. Done after the transaction so a gateway call can
  // never hold a database transaction open.
  if (status === 'CANCELLED') {
    await refundCancelledOrder(
      order.id,
      options.note ?? 'Order cancelled',
      options.actorRole === 'CUSTOMER' ? null : undefined,
    );

    const settled = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderDetailInclude,
    });
    emitOrderEvent(eventForStatus(status), settled, toOrderSummary(settled));
    return settled;
  }

  emitOrderEvent(eventForStatus(status), order, toOrderSummary(order));
  return order;
}

export async function cancelOrder(orderId: string, viewer: { id: string; role: Role }, reason?: string) {
  const order = await getOrderForViewer(orderId, viewer);

  if (!canTransition(order.orderType, order.orderStatus, 'CANCELLED')) {
    throw AppError.badRequest('This order can no longer be cancelled. Please call the café.', 'CANNOT_CANCEL');
  }

  return updateStatus(order.id, 'CANCELLED', {
    note: reason ?? (viewer.role === 'CUSTOMER' ? 'Cancelled by customer' : 'Cancelled by café'),
    actorRole: viewer.role,
  });
}

/**
 * Reorder checks availability and *current* prices rather than replaying the
 * old bill, and reports anything it had to leave behind.
 */
export async function reorder(orderId: string, userId: string) {
  const order = await getOrderForViewer(orderId, { id: userId, role: 'CUSTOMER' });

  const added: string[] = [];
  const unavailable: string[] = [];
  const repriced: { name: string; was: number; now: number }[] = [];

  for (const item of order.items) {
    if (!item.productId) {
      unavailable.push(item.productNameSnapshot);
      continue;
    }

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { modifiers: { include: { modifier: { include: { options: true } } } } },
    });

    if (!product || !product.isAvailable) {
      unavailable.push(item.productNameSnapshot);
      continue;
    }

    // Only carry over customisations that still exist and are still offered.
    const liveOptionIds = new Set(
      product.modifiers.flatMap((link) => link.modifier.options.filter((o) => o.isAvailable).map((o) => o.id)),
    );

    const wantedOptions = await prisma.modifierOption.findMany({
      where: {
        name: { in: item.modifiers.map((m) => m.optionNameSnapshot) },
        modifier: { name: { in: item.modifiers.map((m) => m.modifierNameSnapshot) } },
      },
    });

    const optionIds = wantedOptions.filter((option) => liveOptionIds.has(option.id)).map((option) => option.id);

    try {
      await cartService.addItem({ userId }, {
        productId: product.id,
        quantity: item.quantity,
        modifierOptionIds: optionIds,
        notes: item.notes ?? undefined,
      });

      added.push(product.name);

      const currentUnit = unitPriceFor(
        product.basePrice,
        wantedOptions.filter((option) => liveOptionIds.has(option.id)),
      );
      if (currentUnit !== item.unitPriceSnapshot) {
        repriced.push({ name: product.name, was: item.unitPriceSnapshot, now: currentUnit });
      }
    } catch {
      // A dish whose required options have changed shape can't be replayed.
      unavailable.push(item.productNameSnapshot);
    }
  }

  const cart = await cartService.getCartView({ userId });
  return { cart, added, unavailable, repriced };
}
