import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';

export interface ReviewInput {
  productId: string;
  rating: number;
  title?: string;
  comment: string;
}

/** Recomputes the stored aggregate from the review rows themselves. */
async function refreshProductRating(productId: string) {
  const aggregate = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg: Number((aggregate._avg.rating ?? 0).toFixed(2)),
      ratingCount: aggregate._count.rating,
    },
  });
}

export async function listReviews(productId: string) {
  return prisma.review.findMany({
    where: { productId },
    orderBy: [{ isVerified: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      isVerified: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
}

/**
 * A review is marked "Verified Order" only when we can find a completed order
 * from this customer containing this dish.
 */
export async function createReview(userId: string, input: ReviewInput) {
  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } });
  if (!product) throw AppError.notFound('We couldn’t find that dish.', 'PRODUCT_NOT_FOUND');

  const purchase = await prisma.order.findFirst({
    where: {
      userId,
      orderStatus: { in: ['DELIVERED', 'COLLECTED', 'SERVED'] },
      items: { some: { productId: input.productId } },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!purchase) {
    throw AppError.forbidden('You can review a dish once you’ve ordered it.', 'NOT_PURCHASED');
  }

  const existing = await prisma.review.findUnique({
    where: { userId_productId: { userId, productId: input.productId } },
  });

  const review = existing
    ? await prisma.review.update({
        where: { id: existing.id },
        data: { rating: input.rating, title: input.title, comment: input.comment },
      })
    : await prisma.review.create({
        data: {
          userId,
          productId: input.productId,
          orderId: purchase.id,
          rating: input.rating,
          title: input.title,
          comment: input.comment,
          isVerified: true,
        },
      });

  await refreshProductRating(input.productId);
  return { review, updated: Boolean(existing) };
}

/** Dishes from completed orders that this customer hasn't reviewed yet. */
export async function listReviewableProducts(userId: string) {
  const orders = await prisma.order.findMany({
    where: { userId, orderStatus: { in: ['DELIVERED', 'COLLECTED', 'SERVED'] } },
    include: { items: { select: { productId: true, productNameSnapshot: true, productImageSnapshot: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const reviewed = new Set(
    (await prisma.review.findMany({ where: { userId }, select: { productId: true } })).map((r) => r.productId),
  );

  const seen = new Set<string>();
  const pending: { productId: string; name: string; image: string }[] = [];

  for (const order of orders) {
    for (const item of order.items) {
      if (!item.productId || reviewed.has(item.productId) || seen.has(item.productId)) continue;
      seen.add(item.productId);
      pending.push({ productId: item.productId, name: item.productNameSnapshot, image: item.productImageSnapshot });
    }
  }

  return pending;
}
