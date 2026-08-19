import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { accountApi } from '@/api/endpoints';
import { useAuth } from '@/contexts/AuthContext';

export function useWishlist() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['wishlist'],
    queryFn: () => accountApi.wishlist().then((response) => response.items),
    enabled: isAuthenticated,
  });
}

/** Just the ids, so menu cards can render their heart state cheaply. */
export function useWishlistIds() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['wishlist', 'ids'],
    queryFn: () => accountApi.wishlistIds().then((response) => response.productIds),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

export function useToggleWishlist() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  return useMutation({
    mutationFn: async ({ productId, isSaved }: { productId: string; isSaved: boolean; name?: string }) => {
      if (!isAuthenticated) throw new Error('Sign in to save your favourites.');
      return isSaved ? accountApi.removeFromWishlist(productId) : accountApi.addToWishlist(productId);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success(variables.isSaved ? 'Removed from favourites' : 'Added to favourites');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
