import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as adminService from '../services/admin.service';
import * as tableService from '../services/table.service';
import * as orderService from '../services/order.service';
import * as refundService from '../services/refund.service';
import { updateSettings } from '../services/settings.service';

// ── dashboard ──────────────────────────────────────────────────────────────

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await adminService.getDashboard());
});

// ── orders ─────────────────────────────────────────────────────────────────

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  res.json(await adminService.listOrders(req.query as never));
});

export const kitchenBoard = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ board: await adminService.getKitchenBoard() });
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.updateStatus(req.params.id!, req.body.status, {
    note: req.body.note,
    actorRole: req.user!.role,
  });
  res.json({ order: orderService.toOrderSummary(order) });
});

/** What can still be returned on this order, for the refund dialog. */
export const refundable = asyncHandler(async (req: Request, res: Response) => {
  res.json({ refundable: await refundService.getRefundable(req.params.id!) });
});

/** Issues a full or partial refund. Recorded against the staff member. */
export const refundOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await refundService.issueRefund({
    orderId: req.params.id!,
    amount: req.body.amount,
    reason: req.body.reason,
    issuedByUserId: req.user!.id,
  });

  const order = await orderService.getOrderForViewer(req.params.id!, req.user!);

  res.status(201).json({
    refund: result.refund,
    refundable: result.summary,
    order: orderService.toOrderSummary(order),
  });
});

// ── menu ───────────────────────────────────────────────────────────────────

export const listProducts = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ products: await adminService.listAllProductsForAdmin() });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ product: await adminService.createProduct(req.body) });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  res.json({ product: await adminService.updateProduct(req.params.id!, req.body) });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  res.json(await adminService.deleteProduct(req.params.id!));
});

export const setAvailability = asyncHandler(async (req: Request, res: Response) => {
  res.json({ product: await adminService.setAvailability(req.params.id!, req.body.isAvailable) });
});

export const listModifiers = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ modifiers: await adminService.listModifiers() });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ category: await adminService.createCategory(req.body) });
});

// ── customers & coupons ────────────────────────────────────────────────────

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  res.json({ customers: await adminService.listCustomers(req.query.q as string | undefined) });
});

export const listCoupons = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ coupons: await adminService.listCoupons() });
});

export const upsertCoupon = asyncHandler(async (req: Request, res: Response) => {
  res.json({ coupon: await adminService.upsertCoupon(req.body) });
});

// ── tables & QR ────────────────────────────────────────────────────────────

export const listTables = asyncHandler(async (req: Request, res: Response) => {
  res.json({ tables: await tableService.listTables(req.query.cafeId as string | undefined) });
});

export const createTable = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json({ table: await tableService.createTable(req.body) });
});

export const updateTable = asyncHandler(async (req: Request, res: Response) => {
  res.json({ table: await tableService.updateTable(req.params.id!, req.body) });
});

export const deleteTable = asyncHandler(async (req: Request, res: Response) => {
  res.json(await tableService.deleteTable(req.params.id!));
});

export const tableQr = asyncHandler(async (req: Request, res: Response) => {
  res.json(await tableService.getTableQr(req.params.id!));
});

export const generateTables = asyncHandler(async (req: Request, res: Response) => {
  const tables = await tableService.generateTables(req.body.cafeId, req.body.count, req.body.floor);
  res.status(201).json({ tables });
});

// ── settings ───────────────────────────────────────────────────────────────

export const updateBusinessSettings = asyncHandler(async (req: Request, res: Response) => {
  res.json({ settings: await updateSettings(req.body) });
});
