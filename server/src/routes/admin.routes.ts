import { Router } from 'express';
import * as controller from '../controllers/admin.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateStatusSchema } from '../validators/order.validator';
import {
  adminOrdersSchema,
  availabilitySchema,
  categorySchema,
  couponWriteSchema,
  productUpdateSchema,
  productWriteSchema,
  refundSchema,
  settingsSchema,
  tableCreateSchema,
  tableGenerateSchema,
  tableUpdateSchema,
} from '../validators/misc.validator';

const router = Router();

// Everything here is staff-only. Kitchen staff can see and move orders;
// catalogue, customers, pricing and tables are restricted to admins.
router.use(requireAuth);

const staff = requireRole('STAFF', 'ADMIN');
const admin = requireRole('ADMIN');

// ── kitchen (staff + admin) ──
router.get('/kitchen/board', staff, controller.kitchenBoard);
router.patch('/orders/:id/status', staff, validate(updateStatusSchema), controller.updateOrderStatus);
router.get('/orders', staff, validate(adminOrdersSchema, 'query'), controller.listOrders);

// Returning money is an admin decision, not a floor-staff one.
router.get('/orders/:id/refundable', admin, controller.refundable);
router.post('/orders/:id/refund', admin, validate(refundSchema), controller.refundOrder);

// ── dashboard ──
router.get('/dashboard', admin, controller.dashboard);

// ── menu ──
router.get('/products', admin, controller.listProducts);
router.post('/products', admin, validate(productWriteSchema), controller.createProduct);
router.patch('/products/:id', admin, validate(productUpdateSchema), controller.updateProduct);
router.delete('/products/:id', admin, controller.deleteProduct);
router.patch('/products/:id/availability', staff, validate(availabilitySchema), controller.setAvailability);
router.get('/modifiers', admin, controller.listModifiers);
router.post('/categories', admin, validate(categorySchema), controller.createCategory);

// ── customers & coupons ──
router.get('/customers', admin, controller.listCustomers);
router.get('/coupons', admin, controller.listCoupons);
router.post('/coupons', admin, validate(couponWriteSchema), controller.upsertCoupon);

// ── tables & QR codes ──
router.get('/tables', staff, controller.listTables);
router.post('/tables', admin, validate(tableCreateSchema), controller.createTable);
router.post('/tables/generate', admin, validate(tableGenerateSchema), controller.generateTables);
router.patch('/tables/:id', staff, validate(tableUpdateSchema), controller.updateTable);
router.delete('/tables/:id', admin, controller.deleteTable);
router.get('/tables/:id/qr', staff, controller.tableQr);

// ── settings ──
router.patch('/settings', admin, validate(settingsSchema), controller.updateBusinessSettings);

export default router;
