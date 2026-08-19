import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as orderService from '../services/order.service';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.createOrder(req.user!.id, req.body);
  res.status(201).json({ order: orderService.toOrderSummary(order) });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { filter } = req.query as unknown as { filter: 'all' | 'active' | 'completed' | 'cancelled' };
  res.json({ orders: await orderService.listOrdersForUser(req.user!.id, filter) });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderForViewer(req.params.id!, req.user!);
  res.json({ order: orderService.toOrderSummary(order) });
});

export const tracking = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderForViewer(req.params.id!, req.user!);
  res.json(orderService.buildTracking(order));
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.cancelOrder(req.params.id!, req.user!, req.body?.reason);
  res.json({ order: orderService.toOrderSummary(order) });
});

export const reorder = asyncHandler(async (req: Request, res: Response) => {
  res.json(await orderService.reorder(req.params.id!, req.user!.id));
});
