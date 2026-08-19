import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { productCardSelect } from '../repositories/product.repository';

async function getOrCreateWishlist(userId: string) {
  const existing = await prisma.wishlist.findUnique({ where: { userId } });
  return existing ?? prisma.wishlist.create({ data: { userId } });
}

export async function getWishlist(userId: string) {
  const wishlist = await getOrCreateWishlist(userId);

  const items = await prisma.wishlistItem.findMany({
    where: { wishlistId: wishlist.id },
    orderBy: { createdAt: 'desc' },
    include: { product: { select: productCardSelect } },
  });

  return items.map((item) => ({ id: item.id, addedAt: item.createdAt, product: item.product }));
}

export async function addToWishlist(userId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw AppError.notFound('We couldn’t find that dish.', 'PRODUCT_NOT_FOUND');

  const wishlist = await getOrCreateWishlist(userId);

  // Saving twice is harmless, not an error.
  await prisma.wishlistItem.upsert({
    where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    create: { wishlistId: wishlist.id, productId },
    update: {},
  });

  return getWishlist(userId);
}

export async function removeFromWishlist(userId: string, productId: string) {
  const wishlist = await getOrCreateWishlist(userId);
  await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId } });
  return getWishlist(userId);
}

export async function getWishlistProductIds(userId: string): Promise<string[]> {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    include: { items: { select: { productId: true } } },
  });
  return wishlist?.items.map((item) => item.productId) ?? [];
}
