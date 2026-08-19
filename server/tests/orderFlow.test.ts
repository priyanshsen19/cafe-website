import { describe, expect, it } from 'vitest';
import type { OperatingHour } from '@prisma/client';
import { ORDER_FLOW, canTransition, isActive, statusLabel } from '../src/utils/orderFlow';
import { evaluateOpenState, formatHourRange } from '../src/utils/hours';

describe('order status flow', () => {
  it('ends each order type at its own terminal state', () => {
    expect(ORDER_FLOW.DELIVERY.at(-1)).toBe('DELIVERED');
    expect(ORDER_FLOW.PICKUP.at(-1)).toBe('COLLECTED');
    expect(ORDER_FLOW.DINE_IN.at(-1)).toBe('SERVED');
  });

  it('allows moving forward through the flow', () => {
    expect(canTransition('DELIVERY', 'PLACED', 'CONFIRMED')).toBe(true);
    expect(canTransition('DELIVERY', 'READY', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(canTransition('DINE_IN', 'READY', 'SERVED')).toBe(true);
  });

  it('allows skipping ahead, which a busy counter often does', () => {
    expect(canTransition('PICKUP', 'PLACED', 'READY')).toBe(true);
  });

  it('refuses to move an order backwards', () => {
    expect(canTransition('DELIVERY', 'PREPARING', 'CONFIRMED')).toBe(false);
    expect(canTransition('DELIVERY', 'DELIVERED', 'READY')).toBe(false);
  });

  it('refuses a state belonging to a different order type', () => {
    expect(canTransition('DINE_IN', 'READY', 'OUT_FOR_DELIVERY')).toBe(false);
    expect(canTransition('DELIVERY', 'READY', 'SERVED')).toBe(false);
  });

  it('allows cancelling only before the order is ready', () => {
    expect(canTransition('DELIVERY', 'PLACED', 'CANCELLED')).toBe(true);
    expect(canTransition('DELIVERY', 'PREPARING', 'CANCELLED')).toBe(true);
    expect(canTransition('DELIVERY', 'READY', 'CANCELLED')).toBe(false);
    expect(canTransition('DELIVERY', 'DELIVERED', 'CANCELLED')).toBe(false);
  });

  it('treats a cancelled order as final', () => {
    expect(canTransition('DELIVERY', 'CANCELLED', 'PREPARING')).toBe(false);
  });

  it('rejects a no-op transition', () => {
    expect(canTransition('DELIVERY', 'PREPARING', 'PREPARING')).toBe(false);
  });

  it('phrases READY differently per order type', () => {
    expect(statusLabel('READY', 'PICKUP')).toBe('Ready for pickup');
    expect(statusLabel('READY', 'DELIVERY')).toBe('Ready for dispatch');
    expect(statusLabel('READY', 'DINE_IN')).toBe('Ready');
  });

  it('knows which statuses are still live', () => {
    expect(isActive('PREPARING')).toBe(true);
    expect(isActive('OUT_FOR_DELIVERY')).toBe(true);
    expect(isActive('DELIVERED')).toBe(false);
    expect(isActive('SERVED')).toBe(false);
    expect(isActive('CANCELLED')).toBe(false);
  });
});

describe('operating hours', () => {
  const hour = (dayOfWeek: number, opensAt: number, closesAt: number): OperatingHour => ({
    id: `h${dayOfWeek}`,
    cafeId: 'cafe',
    dayOfWeek,
    opensAt,
    closesAt,
    isClosed: false,
  });

  /** 8:00 AM – 11:00 PM every day. */
  const week = Array.from({ length: 7 }, (_, day) => hour(day, 8 * 60, 23 * 60));

  it('is open during trading hours', () => {
    const midday = new Date('2026-08-19T12:30:00');
    expect(evaluateOpenState(week, midday).isOpen).toBe(true);
  });

  it('is closed before opening, and says when it opens', () => {
    const earlyMorning = new Date('2026-08-19T06:00:00');
    const state = evaluateOpenState(week, earlyMorning);

    expect(state.isOpen).toBe(false);
    expect(state.message).toMatch(/8:00 AM today/);
    expect(state.nextOpensAt).not.toBeNull();
  });

  it('is closed after closing time', () => {
    const lateNight = new Date('2026-08-19T23:30:00');
    expect(evaluateOpenState(week, lateNight).isOpen).toBe(false);
  });

  it('stays open past midnight when closing time rolls over', () => {
    // Saturday closes at 24:00 + 30m; 00:15 on Sunday is still the Saturday window.
    const rollover = [...week];
    rollover[6] = hour(6, 8 * 60, 24 * 60 + 30);

    const sundayEarly = new Date('2026-08-23T00:15:00'); // Sunday
    expect(evaluateOpenState(rollover, sundayEarly).isOpen).toBe(true);
  });

  it('treats a café with no configured hours as always open', () => {
    expect(evaluateOpenState([]).isOpen).toBe(true);
  });

  it('formats a readable range', () => {
    expect(formatHourRange({ opensAt: 8 * 60, closesAt: 23 * 60, isClosed: false })).toBe('8:00 AM – 11:00 PM');
    expect(formatHourRange({ opensAt: 8 * 60, closesAt: 24 * 60, isClosed: false })).toBe('8:00 AM – 12:00 AM');
    expect(formatHourRange({ opensAt: 0, closesAt: 0, isClosed: true })).toBe('Closed');
  });
});
