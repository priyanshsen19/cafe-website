import { Router } from 'express';
import * as controller from '../controllers/order.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/rateLimit';
import {
  cancelOrderSchema,
  createOrderSchema,
  listOrdersSchema,
} from '../validators/order.validator';

const router = Router();

// Ordering is only available to signed-in customers.
router.use(requireAuth);

router.post('/', writeLimiter, validate(createOrderSchema), controller.create);
router.get('/', validate(listOrdersSchema, 'query'), controller.list);
router.get('/:id', controller.detail);
router.get('/:id/tracking', controller.tracking);
router.patch('/:id/cancel', validate(cancelOrderSchema), controller.cancel);
router.post('/:id/reorder', writeLimiter, controller.reorder);

export default router;
