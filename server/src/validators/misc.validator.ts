import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .regex(/^[+]?[0-9\s-]{10,15}$/, 'Enter a valid phone number');

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  fullName: z.string().trim().min(2, 'Enter a name').max(80),
  phone,
  line1: z.string().trim().min(4, 'Enter the street address').max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2, 'Enter a city').max(80),
  state: z.string().trim().min(2, 'Enter a state').max(80),
  postalCode: z.string().trim().regex(/^[0-9]{6}$/, 'Enter a 6-digit PIN code'),
  country: z.string().trim().max(60).optional(),
  addressType: z.enum(['HOME', 'WORK', 'OTHER']).optional(),
  isDefault: z.boolean().optional(),
  instructions: z.string().trim().max(200).optional(),
});

export const updateAddressSchema = addressSchema.partial();

export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1, 'Choose a rating').max(5),
  title: z.string().trim().max(80).optional(),
  comment: z.string().trim().min(4, 'Tell us a little more').max(1000),
});

export const wishlistSchema = z.object({
  productId: z.string().min(1),
});

export const couponPreviewSchema = z.object({
  code: z.string().trim().min(2).max(32),
  subtotal: z.coerce.number().int().min(0),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: phone.optional(),
  subject: z.string().trim().min(3, 'Add a subject').max(120),
  message: z.string().trim().min(10, 'Tell us a little more').max(2000),
});

// ── admin ──────────────────────────────────────────────────────────────────

export const adminOrdersSchema = z.object({
  status: z
    .enum([
      'PLACED',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COLLECTED',
      'SERVED',
      'CANCELLED',
    ])
    .optional(),
  orderType: z.enum(['DELIVERY', 'PICKUP', 'DINE_IN']).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const refundSchema = z.object({
  /** Omit for a full refund of whatever remains outstanding. */
  amount: z.coerce.number().int().min(1, 'Enter an amount').max(1000000).optional(),
  reason: z.string().trim().max(200).optional(),
});

export const productWriteSchema = z.object({
  categoryId: z.string().min(1, 'Choose a category'),
  name: z.string().trim().min(2, 'Enter a name').max(90),
  slug: z.string().trim().max(90).optional(),
  description: z.string().trim().min(10, 'Add a short description').max(400),
  story: z.string().trim().max(1200).optional(),
  basePrice: z.coerce.number().int().min(1, 'Enter a price').max(100000),
  imageUrl: z.string().trim().url('Enter a valid image URL'),
  calories: z.coerce.number().int().min(0).max(5000).optional(),
  prepTimeMinutes: z.coerce.number().int().min(1).max(180).optional(),
  ingredients: z.array(z.string().trim().max(60)).max(30).optional(),
  allergens: z.array(z.string().trim().max(40)).max(20).optional(),
  tags: z.array(z.string().trim().max(40)).max(30).optional(),
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  containsEgg: z.boolean().optional(),
  containsNuts: z.boolean().optional(),
  containsGluten: z.boolean().optional(),
  isSpicy: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isChefSpecial: z.boolean().optional(),
  isSeasonal: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  modifierIds: z.array(z.string().min(1)).max(20).optional(),
});

export const productUpdateSchema = productWriteSchema.partial();

export const availabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  imageUrl: z.string().trim().url().optional(),
});

export const tableCreateSchema = z.object({
  cafeId: z.string().min(1, 'Choose a location'),
  label: z.string().trim().min(1, 'Enter a table label').max(12),
  floor: z.string().trim().max(40).optional(),
  capacity: z.coerce.number().int().min(1).max(40).optional(),
});

export const tableUpdateSchema = z.object({
  label: z.string().trim().min(1).max(12).optional(),
  floor: z.string().trim().max(40).optional(),
  capacity: z.coerce.number().int().min(1).max(40).optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING']).optional(),
  isActive: z.boolean().optional(),
});

export const tableGenerateSchema = z.object({
  cafeId: z.string().min(1),
  count: z.coerce.number().int().min(1).max(50),
  floor: z.string().trim().max(40).optional(),
});

export const couponWriteSchema = z.object({
  id: z.string().min(1).optional(),
  code: z.string().trim().min(3, 'Enter a code').max(32),
  description: z.string().trim().min(4, 'Describe the offer').max(200),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.coerce.number().int().min(1),
  minOrderAmount: z.coerce.number().int().min(0).optional(),
  maxDiscount: z.coerce.number().int().min(0).nullable().optional(),
  maxUses: z.coerce.number().int().min(1).nullable().optional(),
  maxUsesPerUser: z.coerce.number().int().min(1).max(50).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const settingsSchema = z.object({
  taxRatePercent: z.coerce.number().min(0).max(50).optional(),
  deliveryFee: z.coerce.number().int().min(0).max(1000).optional(),
  expressDeliveryFee: z.coerce.number().int().min(0).max(2000).optional(),
  freeDeliveryThreshold: z.coerce.number().int().min(0).max(100000).optional(),
  packagingFee: z.coerce.number().int().min(0).max(500).optional(),
});
