import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as cartService from '../services/cart.service';

/**
 * Cart ownership is derived from the access token when present, and otherwise
 * from the anonymous session cookie — never from the request body.
 */
function ownerFor(req: Request): cartService.CartOwner {
  return req.user ? { userId: req.user.id } : { sessionId: req.cartSessionId };
}

export const get = asyncHandler(async (req: Request, res: Response) => {
  const { orderType, couponCode, deliverySpeed } = req.query as unknown as {
    orderType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
    couponCode?: string;
    deliverySpeed: 'STANDARD' | 'EXPRESS';
  };

  res.json({ cart: await cartService.getCartView(ownerFor(req), { orderType, couponCode, deliverySpeed }) });
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.addItem(ownerFor(req), req.body);
  res.status(201).json({ cart });
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.updateItem(ownerFor(req), req.params.id!, req.body.quantity);
  res.json({ cart });
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.removeItem(ownerFor(req), req.params.id!);
  res.json({ cart });
});

export const clear = asyncHandler(async (req: Request, res: Response) => {
  res.json({ cart: await cartService.clearCart(ownerFor(req)) });
});
