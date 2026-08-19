/** Shapes mirroring the API responses. Kept hand-written and narrow so the UI
 *  depends on a stable contract rather than on Prisma's generated types. */

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';
export type OrderType = 'DELIVERY' | 'PICKUP' | 'DINE_IN';
export type DeliverySpeed = 'STANDARD' | 'EXPRESS';
export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'COD' | 'PAY_AT_COUNTER';
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export type RefundStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface Refund {
  id: string;
  amount: number;
  reason: string | null;
  status: RefundStatus;
  failureReason: string | null;
  /** Null when the system issued it automatically on cancellation. */
  issuedBy: string | null;
  createdAt: string;
}

export interface RefundableSummary {
  paymentId: string | null;
  paidAmount: number;
  refundedAmount: number;
  refundableAmount: number;
  isRefundable: boolean;
  reason: string | null;
}
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
export type AddressType = 'HOME' | 'WORK' | 'OTHER';

export type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COLLECTED'
  | 'SERVED'
  | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  createdAt: string;
}

export interface AccountStats {
  orderCount: number;
  totalSpent: number;
  addressCount: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  productCount: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  imageUrl: string;
  calories: number | null;
  prepTimeMinutes: number;
  tags: string[];
  isVegetarian: boolean;
  isVegan: boolean;
  containsEgg: boolean;
  containsNuts: boolean;
  containsGluten: boolean;
  isSpicy: boolean;
  isBestseller: boolean;
  isNew: boolean;
  isChefSpecial: boolean;
  isSeasonal: boolean;
  isAvailable: boolean;
  ratingAvg: number;
  ratingCount: number;
  orderCount: number;
  sortOrder: number;
  createdAt: string;
  category: { id: string; name: string; slug: string };
  _count?: { modifiers: number };
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  description: string | null;
  selectionType: 'SINGLE' | 'MULTI';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: ModifierOption[];
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  isVerified: boolean;
  createdAt: string;
  user: { name: string };
}

export interface ProductDetail extends Product {
  story: string | null;
  ingredients: string[];
  allergens: string[];
  images: { id: string; url: string; alt: string | null }[];
  modifierGroups: ModifierGroup[];
  reviews: Review[];
  related: Product[];
}

export interface SelectedModifier {
  modifierId: string;
  modifierName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartLine {
  id: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  modifiers: SelectedModifier[];
  modifierSummary: string;
  notes?: string | null;
  isAvailable: boolean;
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  taxRatePercent: number;
  freeDeliveryThreshold: number;
  amountToFreeDelivery: number;
}

export interface CartView {
  id: string;
  lines: CartLine[];
  unavailableLines: CartLine[];
  itemCount: number;
  totals: Totals;
  coupon: { code: string; description: string; discount: number } | null;
}

export interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  addressType: AddressType;
  isDefault: boolean;
  instructions: string | null;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes: string | null;
  modifierSummary: string;
  modifiers: { group: string; option: string; priceDelta: number }[];
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  statusLabel: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  couponCode: string | null;
  notes: string | null;
  contactName: string;
  contactPhone: string;
  scheduledFor: string | null;
  estimatedReadyAt: string | null;
  createdAt: string;
  isActive: boolean;
  itemCount: number;
  items: OrderItem[];
  cafe: { id: string; name: string; slug: string; line1: string; city: string; phone: string } | null;
  table: { id: string; label: string; floor: string } | null;
  deliveryAddress: (Omit<Address, 'id' | 'label' | 'addressType' | 'isDefault'> & { id: string }) | null;
  customer: { id: string; name: string; email: string; phone: string };
  refundedAmount: number;
  refunds: Refund[];
}

export interface TrackingStep {
  status: OrderStatus;
  label: string;
  description: string;
  at: string | null;
  isComplete: boolean;
  isCurrent: boolean;
}

export interface Tracking {
  order: Order;
  isCancelled: boolean;
  cancelledReason: string | null;
  /** The order exists but hasn't been paid for, so it isn't with the kitchen. */
  awaitingPayment: boolean;
  steps: TrackingStep[];
}

export interface OpenState {
  isOpen: boolean;
  opensAt: number | null;
  closesAt: number | null;
  nextOpensAt: string | null;
  message: string | null;
}

export interface Cafe {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  email: string | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  supportsDelivery: boolean;
  tableCount: number;
  openState: OpenState;
  hours: { dayOfWeek: number; day: string; isClosed: boolean; label: string }[];
}

export interface ServiceStatus {
  isOpen: boolean;
  openCount: number;
  totalCount: number;
  nextOpensAt: string | null;
  message: string | null;
  locations: { id: string; name: string; slug: string; state: OpenState }[];
}

export interface TableSession {
  table: { id: string; label: string; floor: string; capacity: number; qrToken: string };
  cafe: Omit<Cafe, 'openState' | 'hours' | 'tableCount'>;
  openState: OpenState;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  maxUses: number | null;
  maxUsesPerUser: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  _count?: { usages: number };
}

export interface CheckoutSession {
  mode: 'razorpay' | 'mock';
  keyId: string | null;
  providerOrderId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  method: 'upi' | 'card' | 'netbanking' | null;
  prefill: { name: string; email: string; contact: string };
  mockPaymentId?: string;
  mockSignature?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Settings {
  taxRatePercent: number;
  deliveryFee: number;
  expressDeliveryFee: number;
  freeDeliveryThreshold: number;
  packagingFee: number;
}

// ── admin ───────────────────────────────────────────────────────────────────

export interface DashboardData {
  metrics: {
    revenueToday: number;
    ordersToday: number;
    averageOrderValue: number;
    customers: number;
    activeOrders: number;
    lifetimeRevenue: number;
    lifetimeOrders: number;
    revenueChangePercent: number | null;
  };
  series: { date: string; revenue: number; orders: number }[];
  orderTypes: { orderType: OrderType; count: number; revenue: number }[];
  statuses: { status: OrderStatus; count: number }[];
  popularDishes: { name: string; quantity: number; revenue: number }[];
}

export interface KitchenCard extends Order {
  ageMinutes: number;
  isUrgent: boolean;
  isScheduled: boolean;
  minutesUntilScheduled: number | null;
}

export interface KitchenBoard {
  NEW: KitchenCard[];
  PREPARING: KitchenCard[];
  READY: KitchenCard[];
  COMPLETED: KitchenCard[];
}

export interface AdminProduct extends Omit<Product, 'category'> {
  story: string | null;
  ingredients: string[];
  allergens: string[];
  categoryId: string;
  category: { id: string; name: string; slug: string };
  modifierIds: string[];
  orderItemCount: number;
  reviewCount: number;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface CafeTable {
  id: string;
  cafeId: string;
  label: string;
  floor: string;
  capacity: number;
  status: TableStatus;
  qrToken: string;
  isActive: boolean;
  cafe: { id: string; name: string; slug: string };
  activeOrderCount: number;
  url: string;
}

export interface TableQr {
  table: { id: string; label: string; floor: string; capacity: number };
  cafe: { name: string; city: string };
  url: string;
  svg: string;
  pngDataUrl: string;
}
