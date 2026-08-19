import type { Request, Response } from 'express';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import * as paymentService from '../services/payment.service';

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const session = await paymentService.createCheckoutSession(req.body.orderId, req.user!.id);
  res.status(201).json({ session });
});

export const verify = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.verifyPayment(req.body, req.user!.id);
  res.json(result);
});

export const fail = asyncHandler(async (req: Request, res: Response) => {
  await paymentService.markFailed(req.body.razorpayOrderId, req.user!.id, req.body.reason);
  res.json({ ok: true });
});

export const retry = asyncHandler(async (req: Request, res: Response) => {
  const session = await paymentService.retryPayment(req.body.orderId, req.user!.id);
  res.status(201).json({ session });
});

/**
 * Razorpay calls this directly. The signature is checked against the raw body
 * captured by the JSON parser, so it must not be re-serialised first.
 */
export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.headers['x-razorpay-signature'] as string | undefined;

  const result = await paymentService.handleWebhook(rawBody, signature);
  res.json(result);
});

/**
 * The online methods this gateway account currently accepts, so the checkout
 * never offers a customer a route the gateway will refuse.
 */
export const methods = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ mode: env.PAYMENT_MODE, methods: await paymentService.getEnabledOnlineMethods() });
});
