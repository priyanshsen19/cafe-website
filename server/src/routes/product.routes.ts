import { Router } from 'express';
import * as controller from '../controllers/product.controller';
import { validate } from '../middleware/validate';
import { listProductsSchema, searchSchema } from '../validators/product.validator';

const router = Router();

router.get('/products', validate(listProductsSchema, 'query'), controller.list);
router.get('/products/search', validate(searchSchema, 'query'), controller.search);
router.get('/products/:slug', controller.detail);
router.get('/categories', controller.categories);
router.get('/collections', controller.collections);

export default router;
