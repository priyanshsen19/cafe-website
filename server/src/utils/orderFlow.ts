import type { OrderStatus, OrderType } from '@prisma/client';
import type { OrderEvent } from '../sockets';

/**
 * Each order type has its own fulfilment path — a delivery goes out for
 * delivery, a pickup gets collected, a dine-in gets served. The flow is defined
 * once here and reused by the tracking timeline, the kitchen board, and the
 * transition guard, so the three can never disagree.
 */
export const ORDER_FLOW: Record<OrderType, OrderStatus[]> = {
  DELIVERY: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  PICKUP: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'COLLECTED'],
  DINE_IN: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'],
};

export const TERMINAL_STATUS: Record<OrderType, OrderStatus> = {
  DELIVERY: 'DELIVERED',
  PICKUP: 'COLLECTED',
  DINE_IN: 'SERVED',
};

/** Customer-facing labels, phrased per order type. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  COLLECTED: 'Collected',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
};

export function statusLabel(status: OrderStatus, orderType: OrderType): string {
  if (status === 'READY') {
    if (orderType === 'PICKUP') return 'Ready for pickup';
    if (orderType === 'DELIVERY') return 'Ready for dispatch';
    return 'Ready';
  }
  return STATUS_LABEL[status];
}

export const STATUS_DESCRIPTION: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Waiting for your payment to complete.',
  PLACED: 'We’ve received your order.',
  CONFIRMED: 'The counter has accepted your order.',
  PREPARING: 'Your order is being made now.',
  READY: 'Everything is ready.',
  OUT_FOR_DELIVERY: 'On the way to you.',
  DELIVERED: 'Delivered. We hope it was good.',
  COLLECTED: 'Collected from the counter.',
  SERVED: 'Served to your table.',
  CANCELLED: 'This order was cancelled.',
};

const EVENT_FOR_STATUS: Record<OrderStatus, OrderEvent> = {
  // Nothing is broadcast for an unpaid order — the kitchen must not see it.
  AWAITING_PAYMENT: 'order:updated',
  PLACED: 'order:created',
  CONFIRMED: 'order:accepted',
  PREPARING: 'order:preparing',
  READY: 'order:ready',
  OUT_FOR_DELIVERY: 'order:out_for_delivery',
  DELIVERED: 'order:delivered',
  COLLECTED: 'order:completed',
  SERVED: 'order:completed',
  CANCELLED: 'order:cancelled',
};

export function eventForStatus(status: OrderStatus): OrderEvent {
  return EVENT_FOR_STATUS[status];
}

/**
 * Staff may advance an order one step, or jump straight to cancelled. Moving
 * backwards is rejected so the customer's timeline never regresses.
 */
export function canTransition(orderType: OrderType, from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (from === 'CANCELLED') return false;

  /**
   * An unpaid order has exactly two futures: it gets paid and becomes a real
   * order, or it is abandoned and cancelled. Staff cannot drag it onto the
   * kitchen board, because nobody has paid for it.
   */
  if (from === 'AWAITING_PAYMENT') return to === 'PLACED' || to === 'CANCELLED';
  // Nothing ever goes back to awaiting payment.
  if (to === 'AWAITING_PAYMENT') return false;

  if (to === 'CANCELLED') return from === 'PLACED' || from === 'CONFIRMED' || from === 'PREPARING';

  const flow = ORDER_FLOW[orderType];
  const fromIndex = flow.indexOf(from);
  const toIndex = flow.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;

  return toIndex > fromIndex;
}

export function isActive(status: OrderStatus): boolean {
  return !['DELIVERED', 'COLLECTED', 'SERVED', 'CANCELLED'].includes(status);
}

/** Statuses the kitchen should act on — an unpaid order is not one of them. */
export const KITCHEN_STATUSES: OrderStatus[] = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
];

/** True while the customer still owes us money for an order that isn't live. */
export function isAwaitingPayment(status: OrderStatus): boolean {
  return status === 'AWAITING_PAYMENT';
}
