import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';
import accountRoutes from './account.routes';
import publicRoutes from './public.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/account', accountRoutes);
router.use('/admin', adminRoutes);

// Catalogue and public content are mounted last so their bare paths
// (/products, /categories, /cafes) don't shadow the namespaced routers above.
router.use('/', productRoutes);
router.use('/', publicRoutes);

export default router;
