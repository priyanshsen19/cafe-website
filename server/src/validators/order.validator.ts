import { z } from 'zod';

export const createOrderSchema = z
  .object({
    orderType: z.enum(['DELIVERY', 'PICKUP', 'DINE_IN']),
    addressId: z.string().min(1).optional(),
    cafeId: z.string().min(1).optional(),
    tableToken: z.string().min(1).optional(),
    scheduledFor: z.string().datetime().optional(),
    deliverySpeed: z.enum(['STANDARD', 'EXPRESS']).optional(),
    paymentMethod: z.enum(['UPI', 'CARD', 'NETBANKING', 'COD', 'PAY_AT_COUNTER']),
    couponCode: z.string().trim().max(32).optional(),
    notes: z.string().trim().max(300).optional(),
    contactName: z.string().trim().min(2).max(80).optional(),
    contactPhone: z
      .string()
      .trim()
      .regex(/^[+]?[0-9\s-]{10,15}$/, 'Enter a valid phone number')
      .optional(),
  })
  // Each fulfilment type needs its own destination, checked before the service runs.
  .refine((data) => data.orderType !== 'DELIVERY' || Boolean(data.addressId), {
    message: 'Choose a delivery address',
    path: ['addressId'],
  })
  .refine((data) => data.orderType !== 'PICKUP' || Boolean(data.cafeId), {
    message: 'Choose a pickup location',
    path: ['cafeId'],
  })
  .refine((data) => data.orderType !== 'DINE_IN' || Boolean(data.tableToken), {
    message: 'Scan your table QR code to order',
    path: ['tableToken'],
  });

export const listOrdersSchema = z.object({
  filter: z.enum(['all', 'active', 'completed', 'cancelled']).default('all'),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([
    'PLACED',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'COLLECTED',
    'SERVED',
    'CANCELLED',
  ]),
  note: z.string().trim().max(200).optional(),
});

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export const failPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  reason: z.string().trim().max(200).optional(),
});

export const createPaymentSchema = z.object({
  orderId: z.string().min(1),
});
