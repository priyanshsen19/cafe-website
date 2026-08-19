import { api, qs } from './client';
import type {
  AccountStats,
  Address,
  AdminCustomer,
  AdminProduct,
  Cafe,
  CafeTable,
  CartView,
  Category,
  CheckoutSession,
  Coupon,
  DashboardData,
  DeliverySpeed,
  KitchenBoard,
  ModifierGroup,
  Order,
  OrderStatus,
  OrderType,
  Pagination,
  PaymentMethod,
  Product,
  ProductDetail,
  Refund,
  RefundableSummary,
  Review,
  ServiceStatus,
  Settings,
  TableQr,
  TableSession,
  Tracking,
  User,
} from '@/types';

// ── auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: { name: string; email: string; phone: string; password: string; confirmPassword: string }) =>
    api.post<{ user: User; accessToken: string }>('/auth/register', body, { skipRefresh: true }),

  login: (body: { email: string; password: string }) =>
    api.post<{ user: User; accessToken: string }>('/auth/login', body, { skipRefresh: true }),

  refresh: () => api.post<{ user: User; accessToken: string }>('/auth/refresh', undefined, { skipRefresh: true }),

  logout: () => api.post<{ ok: true }>('/auth/logout'),

  me: () => api.get<{ user: User; stats: AccountStats }>('/auth/me'),

  updateProfile: (body: { name?: string; phone?: string }) => api.patch<{ user: User }>('/auth/me', body),

  changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    api.post<{ ok: true; message: string }>('/auth/change-password', body),
};

// ── catalogue ───────────────────────────────────────────────────────────────

export interface ProductFilters {
  category?: string;
  q?: string;
  vegetarian?: boolean;
  vegan?: boolean;
  spicy?: boolean;
  bestseller?: boolean;
  isNew?: boolean;
  available?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: 'recommended' | 'popular' | 'price-asc' | 'price-desc' | 'rating' | 'newest';
  page?: number;
  pageSize?: number;
}

export const menuApi = {
  products: (filters: ProductFilters = {}) =>
    api.get<{ items: Product[]; pagination: Pagination }>(`/products${qs(filters)}`),

  search: (q: string, limit = 8) =>
    api.get<{ items: Product[]; categories: { id: string; name: string; slug: string }[] }>(
      `/products/search${qs({ q, limit })}`,
    ),

  product: (slug: string) => api.get<{ product: ProductDetail }>(`/products/${slug}`),

  categories: () => api.get<{ categories: Category[] }>('/categories'),

  collections: () =>
    api.get<{
      collections: {
        signatureCoffee: Product[];
        breakfast: Product[];
        allDay: Product[];
        desserts: Product[];
        seasonal: Product[];
        bestsellers: Product[];
      };
    }>('/collections'),

  reviews: (productId: string) => api.get<{ reviews: Review[] }>(`/reviews/${productId}`),
};

// ── cart ────────────────────────────────────────────────────────────────────

export const cartApi = {
  get: (
    params: {
      orderType?: OrderType;
      couponCode?: string;
      deliverySpeed?: DeliverySpeed;
      paymentMethod?: PaymentMethod;
    } = {},
  ) =>
    api.get<{ cart: CartView }>(`/cart${qs(params)}`),

  addItem: (body: { productId: string; quantity: number; modifierOptionIds: string[]; notes?: string }) =>
    api.post<{ cart: CartView }>('/cart/items', body),

  updateItem: (id: string, quantity: number) => api.patch<{ cart: CartView }>(`/cart/items/${id}`, { quantity }),

  removeItem: (id: string) => api.delete<{ cart: CartView }>(`/cart/items/${id}`),

  clear: () => api.delete<{ cart: CartView }>('/cart'),
};

// ── orders ──────────────────────────────────────────────────────────────────

export interface CreateOrderBody {
  orderType: OrderType;
  addressId?: string;
  cafeId?: string;
  tableToken?: string;
  scheduledFor?: string;
  deliverySpeed?: DeliverySpeed;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  notes?: string;
  contactName?: string;
  contactPhone?: string;
}

export const orderApi = {
  create: (body: CreateOrderBody) => api.post<{ order: Order }>('/orders', body),

  list: (filter: 'all' | 'active' | 'completed' | 'cancelled' = 'all') =>
    api.get<{ orders: Order[] }>(`/orders${qs({ filter })}`),

  detail: (id: string) => api.get<{ order: Order }>(`/orders/${id}`),

  tracking: (id: string) => api.get<Tracking>(`/orders/${id}/tracking`),

  cancel: (id: string, reason?: string) => api.patch<{ order: Order }>(`/orders/${id}/cancel`, { reason }),

  reorder: (id: string) =>
    api.post<{
      cart: CartView;
      added: string[];
      unavailable: string[];
      repriced: { name: string; was: number; now: number }[];
    }>(`/orders/${id}/reorder`),
};

// ── payments ────────────────────────────────────────────────────────────────

export const paymentApi = {
  createSession: (orderId: string) => api.post<{ session: CheckoutSession }>('/payments/create-order', { orderId }),

  retry: (orderId: string) => api.post<{ session: CheckoutSession }>('/payments/retry', { orderId }),

  verify: (body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    api.post<{ alreadyProcessed: boolean; order: Order }>('/payments/verify', body),

  fail: (razorpayOrderId: string, reason?: string) =>
    api.post<{ ok: true }>('/payments/failed', { razorpayOrderId, reason }),

  /** Online methods the gateway account currently accepts. */
  methods: () =>
    api.get<{ mode: 'razorpay' | 'mock'; methods: PaymentMethod[] }>('/payments/methods'),
};

// ── account ─────────────────────────────────────────────────────────────────

export const accountApi = {
  addresses: () => api.get<{ addresses: Address[] }>('/account/addresses'),

  createAddress: (body: Partial<Address>) => api.post<{ address: Address }>('/account/addresses', body),

  updateAddress: (id: string, body: Partial<Address>) =>
    api.patch<{ address: Address }>(`/account/addresses/${id}`, body),

  deleteAddress: (id: string) => api.delete<{ ok: true }>(`/account/addresses/${id}`),

  setDefaultAddress: (id: string) => api.post<{ address: Address }>(`/account/addresses/${id}/default`),

  wishlist: () => api.get<{ items: { id: string; addedAt: string; product: Product }[] }>('/account/wishlist'),

  wishlistIds: () => api.get<{ productIds: string[] }>('/account/wishlist/ids'),

  addToWishlist: (productId: string) =>
    api.post<{ items: { id: string; addedAt: string; product: Product }[] }>('/account/wishlist', { productId }),

  removeFromWishlist: (productId: string) =>
    api.delete<{ items: { id: string; addedAt: string; product: Product }[] }>(`/account/wishlist/${productId}`),

  createReview: (body: { productId: string; rating: number; title?: string; comment: string }) =>
    api.post<{ review: Review; updated: boolean }>('/account/reviews', body),

  pendingReviews: () => api.get<{ products: { productId: string; name: string; image: string }[] }>('/account/reviews/pending'),
};

// ── public ──────────────────────────────────────────────────────────────────

export const publicApi = {
  cafes: () => api.get<{ cafes: Cafe[] }>('/cafes'),

  cafe: (slug: string) => api.get<{ cafe: Cafe }>(`/cafes/${slug}`),

  table: (token: string) => api.get<TableSession>(`/tables/${token}`),

  serviceStatus: () => api.get<ServiceStatus>('/service-status'),

  settings: () => api.get<{ settings: Settings }>('/settings'),

  coupons: () => api.get<{ coupons: Coupon[] }>('/coupons'),

  previewCoupon: (code: string, subtotal: number) =>
    api.post<{ coupon: { code: string; description: string; discountType: string; discount: number } }>(
      '/coupons/preview',
      { code, subtotal },
    ),

  contact: (body: { name: string; email: string; phone?: string; subject: string; message: string }) =>
    api.post<{ ok: true; message: string }>('/contact', body),
};

// ── admin & kitchen ─────────────────────────────────────────────────────────

export const adminApi = {
  dashboard: () => api.get<DashboardData>('/admin/dashboard'),

  kitchenBoard: () => api.get<{ board: KitchenBoard }>('/admin/kitchen/board'),

  updateOrderStatus: (id: string, status: OrderStatus, note?: string) =>
    api.patch<{ order: Order }>(`/admin/orders/${id}/status`, { status, note }),

  refundable: (id: string) => api.get<{ refundable: RefundableSummary }>(`/admin/orders/${id}/refundable`),

  refund: (id: string, body: { amount?: number; reason?: string }) =>
    api.post<{ refund: Refund; refundable: RefundableSummary; order: Order }>(`/admin/orders/${id}/refund`, body),

  orders: (params: { status?: OrderStatus; orderType?: OrderType; q?: string; page?: number; pageSize?: number } = {}) =>
    api.get<{ orders: Order[]; pagination: Pagination }>(`/admin/orders${qs(params)}`),

  products: () => api.get<{ products: AdminProduct[] }>('/admin/products'),

  createProduct: (body: Record<string, unknown>) => api.post<{ product: AdminProduct }>('/admin/products', body),

  updateProduct: (id: string, body: Record<string, unknown>) =>
    api.patch<{ product: AdminProduct }>(`/admin/products/${id}`, body),

  deleteProduct: (id: string) => api.delete<{ ok: true; retired: boolean }>(`/admin/products/${id}`),

  setAvailability: (id: string, isAvailable: boolean) =>
    api.patch<{ product: AdminProduct }>(`/admin/products/${id}/availability`, { isAvailable }),

  modifiers: () => api.get<{ modifiers: ModifierGroup[] }>('/admin/modifiers'),

  createCategory: (body: { name: string; description?: string; imageUrl?: string }) =>
    api.post<{ category: Category }>('/admin/categories', body),

  customers: (q?: string) => api.get<{ customers: AdminCustomer[] }>(`/admin/customers${qs({ q })}`),

  coupons: () => api.get<{ coupons: Coupon[] }>('/admin/coupons'),

  upsertCoupon: (body: Record<string, unknown>) => api.post<{ coupon: Coupon }>('/admin/coupons', body),

  tables: (cafeId?: string) => api.get<{ tables: CafeTable[] }>(`/admin/tables${qs({ cafeId })}`),

  createTable: (body: { cafeId: string; label: string; floor?: string; capacity?: number }) =>
    api.post<{ table: CafeTable }>('/admin/tables', body),

  generateTables: (body: { cafeId: string; count: number; floor?: string }) =>
    api.post<{ tables: CafeTable[] }>('/admin/tables/generate', body),

  updateTable: (id: string, body: Record<string, unknown>) => api.patch<{ table: CafeTable }>(`/admin/tables/${id}`, body),

  deleteTable: (id: string) => api.delete<{ ok: true; deactivated: boolean }>(`/admin/tables/${id}`),

  tableQr: (id: string) => api.get<TableQr>(`/admin/tables/${id}/qr`),

  updateSettings: (body: Partial<Settings>) => api.patch<{ settings: Settings }>('/admin/settings', body),
};
