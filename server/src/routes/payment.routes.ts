import { Router } from 'express';
import * as controller from '../controllers/payment.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/rateLimit';
import {
  createPaymentSchema,
  failPaymentSchema,
  verifyPaymentSchema,
} from '../validators/order.validator';

const router = Router();

// The webhook is authenticated by its HMAC signature, not by a user session,
// so it is mounted before the auth guard.
router.post('/webhook', controller.webhook);

// Which methods the gateway accepts is public information — Checkout.js reads
// the same list from the browser — and the checkout needs it before it has
// anything to write, so it sits ahead of the auth guard too.
router.get('/methods', controller.methods);

router.use(requireAuth);

router.post('/create-order', writeLimiter, validate(createPaymentSchema), controller.createOrder);
router.post('/verify', writeLimiter, validate(verifyPaymentSchema), controller.verify);
router.post('/failed', validate(failPaymentSchema), controller.fail);
router.post('/retry', writeLimiter, validate(createPaymentSchema), controller.retry);

export default router;
