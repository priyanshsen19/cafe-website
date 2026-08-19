import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as addressService from '../services/address.service';
import * as wishlistService from '../services/wishlist.service';
import * as reviewService from '../services/review.service';
import * as cafeService from '../services/cafe.service';
import * as couponService from '../services/coupon.service';
import { getSettings } from '../services/settings.service';

// ── addresses ──────────────────────────────────────────────────────────────

export const listAddresses = asyncHandler(async (req: Request, res: Response) => {
  res.json({ addresses: await addressService.listAddresses(req.user!.id) });
});

export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ address: await addressService.createAddress(req.user!.id, req.body) });
});

export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  res.json({ address: await addressService.updateAddress(req.user!.id, req.params.id!, req.body) });
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  res.json(await addressService.deleteAddress(req.user!.id, req.params.id!));
});

export const setDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  res.json({ address: await addressService.setDefault(req.user!.id, req.params.id!) });
});

// ── wishlist ───────────────────────────────────────────────────────────────

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  res.json({ items: await wishlistService.getWishlist(req.user!.id) });
});

export const addToWishlist = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ items: await wishlistService.addToWishlist(req.user!.id, req.body.productId) });
});

export const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  res.json({ items: await wishlistService.removeFromWishlist(req.user!.id, req.params.productId!) });
});

export const wishlistIds = asyncHandler(async (req: Request, res: Response) => {
  res.json({ productIds: await wishlistService.getWishlistProductIds(req.user!.id) });
});

// ── reviews ────────────────────────────────────────────────────────────────

export const listReviews = asyncHandler(async (req: Request, res: Response) => {
  res.json({ reviews: await reviewService.listReviews(req.params.productId!) });
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await reviewService.createReview(req.user!.id, req.body));
});

export const reviewableProducts = asyncHandler(async (req: Request, res: Response) => {
  res.json({ products: await reviewService.listReviewableProducts(req.user!.id) });
});

// ── locations ──────────────────────────────────────────────────────────────

export const listCafes = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ cafes: await cafeService.listCafes() });
});

export const cafeDetail = asyncHandler(async (req: Request, res: Response) => {
  res.json({ cafe: await cafeService.getCafeBySlug(req.params.slug!) });
});

export const resolveTable = asyncHandler(async (req: Request, res: Response) => {
  res.json(await cafeService.resolveTableToken(req.params.token!));
});

export const serviceStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await cafeService.getServiceStatus());
});

// ── coupons & settings ─────────────────────────────────────────────────────

export const activeCoupons = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ coupons: await couponService.listActiveCoupons() });
});

export const previewCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, subtotal } = req.body as { code: string; subtotal: number };
  res.json({ coupon: await couponService.previewCoupon(code, subtotal, req.user!.id) });
});

/** Public pricing rules the client needs to render the bill breakdown. */
export const publicSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getSettings();
  res.json({
    settings: {
      taxRatePercent: settings.taxRatePercent,
      deliveryFee: settings.deliveryFee,
      expressDeliveryFee: settings.expressDeliveryFee,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      packagingFee: settings.packagingFee,
    },
  });
});

/**
 * Contact form. Validated and acknowledged; wiring an email provider is a
 * deployment concern, so the submission is logged rather than silently dropped.
 */
export const submitContact = asyncHandler(async (req: Request, res: Response) => {
  // eslint-disable-next-line no-console
  console.log('[contact] enquiry received', {
    name: req.body.name,
    email: req.body.email,
    subject: req.body.subject,
  });

  res.status(201).json({
    ok: true,
    message: 'Thank you — we’ve got your note and will reply within one working day.',
  });
});
