import { Router } from 'express';
import * as controller from '../controllers/cart.controller';
import { validate } from '../middleware/validate';
import { optionalAuth } from '../middleware/auth';
import { addItemSchema, cartQuerySchema, updateItemSchema } from '../validators/cart.validator';

const router = Router();

// Guests may build a cart; the cookie-scoped session identifies it.
router.use(optionalAuth);

router.get('/', validate(cartQuerySchema, 'query'), controller.get);
router.post('/items', validate(addItemSchema), controller.addItem);
router.patch('/items/:id', validate(updateItemSchema), controller.updateItem);
router.delete('/items/:id', controller.removeItem);
router.delete('/', controller.clear);

export default router;
