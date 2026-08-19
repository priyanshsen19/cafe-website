import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Checkbox, RadioGroup, RadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { accountApi } from '@/api/endpoints';
import { cn } from '@/lib/utils';
import type { Address } from '@/types';

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  fullName: z.string().trim().min(2, 'Enter a name').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s-]{10,15}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(4, 'Enter the street address').max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(2, 'Enter a city').max(80),
  state: z.string().trim().min(2, 'Enter a state').max(80),
  postalCode: z.string().trim().regex(/^[0-9]{6}$/, 'Enter a 6-digit PIN code'),
  addressType: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
  instructions: z.string().trim().max(200).optional(),
  isDefault: z.boolean().optional(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

/** Saved-address list with an inline "add new" dialog, used at checkout. */
export function AddressPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [isDialogOpen, setDialogOpen] = useState(false);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => accountApi.addresses().then((response) => response.addresses),
  });

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    );
  }

  const list = addresses ?? [];

  return (
    <>
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
          <p className="font-sans text-sm text-foreground">No saved addresses yet</p>
          <p className="mt-1 font-sans text-xs text-muted-foreground">
            Add where you’d like this delivered.
          </p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add an address
          </Button>
        </div>
      ) : (
        <>
          <RadioGroup value={selectedId ?? ''} onValueChange={onSelect} className="gap-2.5" aria-label="Delivery address">
            {list.map((address) => (
              <label
                key={address.id}
                className={cn(
                  'flex cursor-pointer gap-3.5 rounded-lg border p-4 transition-colors',
                  selectedId === address.id
                    ? 'border-espresso bg-secondary/70'
                    : 'border-border bg-card hover:border-espresso/35',
                )}
              >
                <RadioGroupItem value={address.id} className="mt-0.5" />
                <div className="min-w-0 flex-1">
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
                  <p className="mt-1.5 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ''}
                    <br />
                    {address.city}, {address.state} {address.postalCode}
                  </p>
                  <p className="mt-1 font-sans text-xs text-muted-foreground">
                    {address.fullName} · {address.phone}
                  </p>
                  {address.instructions && (
                    <p className="mt-1.5 font-sans text-xs italic text-muted-foreground">“{address.instructions}”</p>
                  )}
                </div>
              </label>
            ))}
          </RadioGroup>

          <Button variant="outline" size="sm" className="mt-3.5" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add another address
          </Button>
        </>
      )}

      <AddressDialog
        open={isDialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(address) => {
          onSelect(address.id);
          setDialogOpen(false);
        }}
      />
    </>
  );
}

/** Create/edit form. Reused by checkout and the account address book. */
export function AddressDialog({
  open,
  onOpenChange,
  address,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: Address;
  onSaved?: (address: Address) => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(address);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    values: address
      ? {
          label: address.label ?? '',
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2 ?? '',
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          addressType: address.addressType,
          instructions: address.instructions ?? '',
          isDefault: address.isDefault,
        }
      : undefined,
    defaultValues: { addressType: 'HOME' },
  });

  const save = useMutation({
    mutationFn: (values: AddressFormValues) => {
      const payload = {
        ...values,
        label: values.label?.trim() || undefined,
        line2: values.line2?.trim() || undefined,
        instructions: values.instructions?.trim() || undefined,
      };
      return isEditing
        ? accountApi.updateAddress(address!.id, payload).then((response) => response.address)
        : accountApi.createAddress(payload).then((response) => response.address);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
      void queryClient.invalidateQueries({ queryKey: ['account'] });
      toast.success(isEditing ? 'Address updated' : 'Address saved successfully');
      reset();
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit address' : 'Add an address'}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="min-h-0 flex-1 overflow-y-auto px-6 pb-2"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="a-fullName">Full name</Label>
              <Input id="a-fullName" className="mt-1.5" invalid={Boolean(errors.fullName)} {...register('fullName')} />
              <FieldError>{errors.fullName?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="a-phone">Phone</Label>
              <Input id="a-phone" type="tel" className="mt-1.5" invalid={Boolean(errors.phone)} {...register('phone')} />
              <FieldError>{errors.phone?.message}</FieldError>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="a-line1">Address line 1</Label>
              <Input
                id="a-line1"
                className="mt-1.5"
                placeholder="Flat / building / street"
                invalid={Boolean(errors.line1)}
                {...register('line1')}
              />
              <FieldError>{errors.line1?.message}</FieldError>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="a-line2">Address line 2 (optional)</Label>
              <Input id="a-line2" className="mt-1.5" placeholder="Area / landmark" {...register('line2')} />
            </div>

            <div>
              <Label htmlFor="a-city">City</Label>
              <Input id="a-city" className="mt-1.5" invalid={Boolean(errors.city)} {...register('city')} />
              <FieldError>{errors.city?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="a-state">State</Label>
              <Input id="a-state" className="mt-1.5" invalid={Boolean(errors.state)} {...register('state')} />
              <FieldError>{errors.state?.message}</FieldError>
            </div>

            <div>
              <Label htmlFor="a-postalCode">PIN code</Label>
              <Input
                id="a-postalCode"
                inputMode="numeric"
                maxLength={6}
                className="mt-1.5"
                invalid={Boolean(errors.postalCode)}
                {...register('postalCode')}
              />
              <FieldError>{errors.postalCode?.message}</FieldError>
            </div>

            <div>
              <Label htmlFor="a-type">Address type</Label>
              <Select
                value={watch('addressType')}
                onValueChange={(value) => setValue('addressType', value as AddressFormValues['addressType'])}
              >
                <SelectTrigger id="a-type" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">Home</SelectItem>
                  <SelectItem value="WORK">Work</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="a-label">Nickname (optional)</Label>
              <Input id="a-label" className="mt-1.5" placeholder="Home, Studio, Parents…" {...register('label')} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="a-instructions">Delivery instructions (optional)</Label>
              <Textarea
                id="a-instructions"
                className="mt-1.5"
                placeholder="Gate code, which floor, where to leave it…"
                {...register('instructions')}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
              <Checkbox
                checked={watch('isDefault') ?? false}
                onCheckedChange={(checked) => setValue('isDefault', checked === true)}
              />
              <span className="font-sans text-sm text-foreground">Use as my default address</span>
            </label>
          </div>

          <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end gap-2.5 border-t border-border bg-card px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEditing ? 'Save changes' : 'Save address'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
