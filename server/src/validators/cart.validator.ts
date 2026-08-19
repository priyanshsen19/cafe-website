import { z } from 'zod';

export const addItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(30).default(1),
  modifierOptionIds: z.array(z.string().min(1)).max(20).default([]),
  notes: z.string().trim().max(200).optional(),
});

export const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(30),
});

export const cartQuerySchema = z.object({
  orderType: z.enum(['DELIVERY', 'PICKUP', 'DINE_IN']).default('DELIVERY'),
  couponCode: z.string().trim().max(32).optional(),
  deliverySpeed: z.enum(['STANDARD', 'EXPRESS']).default('STANDARD'),
  paymentMethod: z.enum(['UPI', 'CARD', 'NETBANKING', 'COD', 'PAY_AT_COUNTER']).optional(),
});
