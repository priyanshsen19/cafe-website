import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/States';
import { AddressDialog } from '@/components/checkout/AddressPicker';
import { accountApi } from '@/api/endpoints';
import { useSeo } from '@/hooks/useUtils';
import type { Address } from '@/types';

export default function AccountAddresses() {
  useSeo({ title: 'My addresses', canonicalPath: '/account/addresses' });

  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Address | null>(null);
  const [isCreating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => accountApi.addresses().then((response) => response.addresses),
  });

  const remove = useMutation({
    mutationFn: (id: string) => accountApi.deleteAddress(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Address removed');
      setConfirmDelete(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => accountApi.setDefaultAddress(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Default address updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addresses = data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-foreground">Addresses</h2>
          <p className="mt-2 font-sans text-sm text-muted-foreground">
            Where we deliver. Your default is used automatically at checkout.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Add address
        </Button>
      </div>

      {isLoading && (
        <div className="mt-8 grid gap-3.5 sm:grid-cols-2">
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
        </div>
      )}

      {!isLoading && addresses.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No addresses saved yet"
          description="Add one now and checkout takes two taps next time."
          action={{ label: 'Add an address', onClick: () => setCreating(true) }}
          className="mt-8 rounded-lg border border-border bg-card"
        />
      )}

      {addresses.length > 0 && (
        <ul className="mt-8 grid gap-3.5 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-sans text-sm font-medium text-foreground">
                  {address.label ?? address.fullName}
                </span>
                <Badge variant="muted" size="sm">
                  {address.addressType.toLowerCase()}
                </Badge>
                {address.isDefault && (
                  <Badge variant="olive" size="sm">
                    Default
                  </Badge>
                )}
              </div>

              <p className="mt-2.5 flex-1 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.country}
              </p>

              <p className="mt-2 font-sans text-xs text-muted-foreground">
                {address.fullName} · {address.phone}
              </p>

              {address.instructions && (
                <p className="mt-2 font-sans text-xs italic text-muted-foreground">“{address.instructions}”</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
                <Button size="sm" variant="ghost" onClick={() => setEditing(address)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>

                {!address.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={setDefault.isPending && setDefault.variables === address.id}
                    onClick={() => setDefault.mutate(address.id)}
                  >
                    <Star className="h-3.5 w-3.5" />
                    Set default
                  </Button>
                )}

                {confirmDelete === address.id ? (
                  <span className="ml-auto flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="destructive"
                      loading={remove.isPending}
                      onClick={() => remove.mutate(address.id)}
                    >
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmDelete(address.id)}
                    aria-label={`Delete ${address.label ?? address.line1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressDialog open={isCreating} onOpenChange={setCreating} />
      <AddressDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        address={editing ?? undefined}
      />
    </div>
  );
}
