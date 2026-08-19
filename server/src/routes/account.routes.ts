import { Router } from 'express';
import * as controller from '../controllers/misc.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addressSchema, reviewSchema, updateAddressSchema, wishlistSchema } from '../validators/misc.validator';

const router = Router();

router.use(requireAuth);

// ── addresses ──
router.get('/addresses', controller.listAddresses);
router.post('/addresses', validate(addressSchema), controller.createAddress);
router.patch('/addresses/:id', validate(updateAddressSchema), controller.updateAddress);
router.delete('/addresses/:id', controller.deleteAddress);
router.post('/addresses/:id/default', controller.setDefaultAddress);

// ── wishlist ──
router.get('/wishlist', controller.getWishlist);
router.get('/wishlist/ids', controller.wishlistIds);
router.post('/wishlist', validate(wishlistSchema), controller.addToWishlist);
router.delete('/wishlist/:productId', controller.removeFromWishlist);

// ── reviews ──
router.post('/reviews', validate(reviewSchema), controller.createReview);
router.get('/reviews/pending', controller.reviewableProducts);

export default router;
