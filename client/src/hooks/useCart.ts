import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cartApi } from '@/api/endpoints';
import { useAuth } from '@/contexts/AuthContext';
import { useUiStore } from '@/store/ui';
import type { DeliverySpeed, OrderType } from '@/types';

export const cartKeys = {
  all: ['cart'] as const,
  view: (
    scope: string,
    orderType: OrderType,
    couponCode?: string,
    deliverySpeed?: DeliverySpeed,
  ) => ['cart', scope, orderType, couponCode ?? null, deliverySpeed ?? 'STANDARD'] as const,
};

export function useCart(
  options: { orderType?: OrderType; couponCode?: string; deliverySpeed?: DeliverySpeed } = {},
) {
  const orderType = options.orderType ?? 'DELIVERY';
  const { user, isLoading: isAuthLoading } = useAuth();

  // The cart is keyed by who is asking. A guest and a signed-in customer have
  // genuinely different carts, so signing in changes the key and fetches the
  // right one instead of reusing the guest's cached (empty) result.
  const scope = user?.id ?? 'guest';

  return useQuery({
    queryKey: cartKeys.view(scope, orderType, options.couponCode, options.deliverySpeed),
    queryFn: () =>
      cartApi
        .get({ orderType, couponCode: options.couponCode, deliverySpeed: options.deliverySpeed })
        .then((response) => response.cart),
    // Don't fetch a guest cart while the session is still being restored —
    // that request would race the token and come back empty.
    enabled: !isAuthLoading,
    staleTime: 10_000,
  });
}

/** Adds a customised line, then nudges the drawer open as confirmation. */
export function useAddToCart() {
  const queryClient = useQueryClient();
  const openCart = useUiStore((state) => state.openCart);

  return useMutation({
    mutationFn: (input: { productId: string; quantity: number; modifierOptionIds: string[]; notes?: string }) =>
      cartApi.addItem(input).then((response) => response.cart),
    onSuccess: (_cart, variables) => {
      seedCartCaches(queryClient);
      toast.success('Added to your order', {
        description: variables.quantity > 1 ? `${variables.quantity} added` : undefined,
      });
      openCart();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      cartApi.updateItem(id, quantity).then((response) => response.cart),
    onSuccess: () => seedCartCaches(queryClient),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cartApi.removeItem(id).then((response) => response.cart),
    onSuccess: () => {
      seedCartCaches(queryClient);
      toast.success('Removed from your order');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cartApi.clear().then((response) => response.cart),
    onSuccess: () => seedCartCaches(queryClient),
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * A mutation returns the cart priced for one order type, but several variants
 * may be mounted at once (drawer, cart page, checkout — each with its own order
 * type, coupon and delivery speed). Rather than guess which cached entry the
 * response belongs to, every cart query is invalidated so each refetches its own
 * correctly-priced total.
 */
function seedCartCaches(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: cartKeys.all });
}
