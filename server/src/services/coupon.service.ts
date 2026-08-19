import type { Coupon, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { formatINR } from '../utils/money';
import { computeCouponDiscount } from './pricing.service';

/**
 * Coupons are always validated server-side against the *server's* subtotal.
 * Throws a customer-readable reason when the code can't be applied.
 */
export async function validateCoupon(code: string, subtotal: number, userId: string): Promise<Coupon> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });

  if (!coupon || !coupon.isActive) {
    throw AppError.badRequest('That code isn’t valid.', 'COUPON_INVALID');
  }

  const now = new Date();
  if (coupon.startsAt > now) {
    throw AppError.badRequest('That code isn’t active yet.', 'COUPON_NOT_STARTED');
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw AppError.badRequest('That code has expired.', 'COUPON_EXPIRED');
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw AppError.badRequest('That code has been fully redeemed.', 'COUPON_EXHAUSTED');
  }
  if (subtotal < coupon.minOrderAmount) {
    throw AppError.badRequest(
      `Add ${formatINR(coupon.minOrderAmount - subtotal)} more to use this code.`,
      'COUPON_MIN_ORDER',
    );
  }

  const usedByCustomer = await prisma.couponUsage.count({ where: { couponId: coupon.id, userId } });
  if (usedByCustomer >= coupon.maxUsesPerUser) {
    throw AppError.badRequest('You’ve already used this code.', 'COUPON_ALREADY_USED');
  }

  return coupon;
}

export async function previewCoupon(code: string, subtotal: number, userId: string) {
  const coupon = await validateCoupon(code, subtotal, userId);
  return {
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discount: computeCouponDiscount(coupon, subtotal),
  };
}

/** Recorded inside the order transaction so usage counts can't drift. */
export async function recordUsage(
  tx: Prisma.TransactionClient,
  input: { couponId: string; userId: string; orderId: string; discountAmount: number },
): Promise<void> {
  await tx.couponUsage.create({ data: input });
  await tx.coupon.update({ where: { id: input.couponId }, data: { usedCount: { increment: 1 } } });
}

export function listActiveCoupons() {
  const now = new Date();
  return prisma.coupon.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    orderBy: { minOrderAmount: 'asc' },
  });
}
