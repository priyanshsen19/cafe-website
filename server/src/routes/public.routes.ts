import { Router } from 'express';
import * as controller from '../controllers/misc.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { contactSchema, couponPreviewSchema } from '../validators/misc.validator';

const router = Router();

router.get('/cafes', controller.listCafes);
router.get('/cafes/:slug', controller.cafeDetail);
router.get('/tables/:token', controller.resolveTable);
router.get('/service-status', controller.serviceStatus);
router.get('/settings', controller.publicSettings);
router.get('/coupons', controller.activeCoupons);
router.get('/reviews/:productId', controller.listReviews);
router.post('/contact', validate(contactSchema), controller.submitContact);

// Previewing a coupon needs an identity, since per-customer limits apply.
router.post('/coupons/preview', requireAuth, validate(couponPreviewSchema), controller.previewCoupon);

export default router;
