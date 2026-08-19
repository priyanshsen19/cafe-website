import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FieldHint, Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { adminApi } from '@/api/endpoints';
import { useSeo } from '@/hooks/useUtils';
import { formatDate, formatINR } from '@/lib/utils';
import type { Coupon } from '@/types';

export default function AdminCoupons() {
  useSeo({ title: 'Coupons — Admin' });

  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [isCreating, setCreating] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: () => adminApi.coupons().then((response) => response.coupons),
  });

  const toggleActive = useMutation({
    mutationFn: (coupon: Coupon) =>
      adminApi.upsertCoupon({
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscount: coupon.maxDiscount,
        maxUses: coupon.maxUses,
        maxUsesPerUser: coupon.maxUsesPerUser,
        expiresAt: coupon.expiresAt,
        isActive: !coupon.isActive,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      toast.success('Coupon updated');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const coupons = data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-foreground">Coupons</h1>
          <p className="mt-1.5 font-sans text-sm text-muted-foreground">
            Discounts are validated server-side against the real subtotal, per customer.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New coupon
        </Button>
      </div>

      {isError && (
        <ErrorState
          title="Unable to load coupons"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !isError && coupons.length === 0 && (
        <EmptyState
          icon={Tag}
          title="No coupons yet"
          description="Create one to run an offer."
          action={{ label: 'New coupon', onClick: () => setCreating(true) }}
          className="mt-6 rounded-lg border border-border bg-card"
        />
      )}

      {coupons.length > 0 && (
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => {
            const isExpired = coupon.expiresAt ? new Date(coupon.expiresAt) < new Date() : false;

            return (
              <li key={coupon.id} className="flex flex-col rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl tracking-wide text-foreground">{coupon.code}</p>
                    <p className="mt-1 font-sans text-[0.8125rem] text-muted-foreground">{coupon.description}</p>
                  </div>
                  <Badge variant={isExpired ? 'subtle' : coupon.isActive ? 'olive' : 'muted'} size="sm">
                    {isExpired ? 'Expired' : coupon.isActive ? 'Active' : 'Paused'}
                  </Badge>
                </div>

                <dl className="mt-4 flex-1 space-y-1.5 font-sans text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Discount</dt>
                    <dd className="text-foreground">
                      {coupon.discountType === 'PERCENTAGE'
                        ? `${coupon.discountValue}%${coupon.maxDiscount ? ` (max ${formatINR(coupon.maxDiscount)})` : ''}`
                        : formatINR(coupon.discountValue)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Minimum order</dt>
                    <dd className="text-foreground">
                      {coupon.minOrderAmount > 0 ? formatINR(coupon.minOrderAmount) : 'None'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Used</dt>
                    <dd className="text-foreground">
                      {coupon.usedCount}
                      {coupon.maxUses ? ` / ${coupon.maxUses}` : ''} · {coupon.maxUsesPerUser} per customer
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Expires</dt>
                    <dd className="text-foreground">{coupon.expiresAt ? formatDate(coupon.expiresAt) : 'Never'}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <Switch
                      checked={coupon.isActive}
                      onCheckedChange={() => toggleActive.mutate(coupon)}
                      aria-label={`${coupon.code} active`}
                    />
                    <span className="font-sans text-xs text-muted-foreground">
                      {coupon.isActive ? 'Active' : 'Paused'}
                    </span>
                  </label>

                  <Button size="sm" variant="ghost" onClick={() => setEditing(coupon)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CouponDialog
        open={isCreating || Boolean(editing)}
        coupon={editing ?? undefined}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </div>
  );
}

function CouponDialog({
  open,
  coupon,
  onOpenChange,
}: {
  open: boolean;
  coupon?: Coupon;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(coupon);

  const [code, setCode] = useState(coupon?.code ?? '');
  const [description, setDescription] = useState(coupon?.description ?? '');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>(coupon?.discountType ?? 'PERCENTAGE');
  const [discountValue, setDiscountValue] = useState(String(coupon?.discountValue ?? 10));
  const [minOrderAmount, setMinOrderAmount] = useState(String(coupon?.minOrderAmount ?? 0));
  const [maxDiscount, setMaxDiscount] = useState(coupon?.maxDiscount ? String(coupon.maxDiscount) : '');
  const [maxUses, setMaxUses] = useState(coupon?.maxUses ? String(coupon.maxUses) : '');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState(String(coupon?.maxUsesPerUser ?? 1));
  const [expiresAt, setExpiresAt] = useState(coupon?.expiresAt ? coupon.expiresAt.slice(0, 10) : '');

  const save = useMutation({
    mutationFn: () =>
      adminApi.upsertCoupon({
        id: coupon?.id,
        code: code.trim().toUpperCase(),
        description: description.trim(),
        discountType,
        discountValue: Number(discountValue),
        minOrderAmount: Number(minOrderAmount) || 0,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        maxUsesPerUser: Number(maxUsesPerUser) || 1,
        // A date input gives a day; send end-of-day so the code lasts all of it.
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        isActive: coupon?.isActive ?? true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      void queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success(isEditing ? 'Coupon updated' : 'Coupon created');
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit ${coupon!.code}` : 'New coupon'}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-code">Code</Label>
              <Input
                id="c-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="WELCOME10"
                className="mt-1.5 uppercase"
              />
            </div>
            <div>
              <Label htmlFor="c-type">Type</Label>
              <Select value={discountType} onValueChange={(value) => setDiscountType(value as 'PERCENTAGE' | 'FIXED')}>
                <SelectTrigger id="c-type" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentage off</SelectItem>
                  <SelectItem value="FIXED">Fixed amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="c-description">Description</Label>
            <Input
              id="c-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="10% off your first order, up to ₹150"
              className="mt-1.5"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-value">{discountType === 'PERCENTAGE' ? 'Percent off' : 'Amount off (₹)'}</Label>
              <Input
                id="c-value"
                type="number"
                inputMode="numeric"
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="c-max">Max discount (₹)</Label>
              <Input
                id="c-max"
                type="number"
                inputMode="numeric"
                value={maxDiscount}
                onChange={(event) => setMaxDiscount(event.target.value)}
                placeholder="No cap"
                disabled={discountType === 'FIXED'}
                className="mt-1.5"
              />
              <FieldHint>Only applies to percentage discounts.</FieldHint>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="c-min">Minimum order (₹)</Label>
              <Input
                id="c-min"
                type="number"
                inputMode="numeric"
                value={minOrderAmount}
                onChange={(event) => setMinOrderAmount(event.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="c-uses">Total uses</Label>
              <Input
                id="c-uses"
                type="number"
                inputMode="numeric"
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                placeholder="Unlimited"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="c-per-user">Per customer</Label>
              <Input
                id="c-per-user"
                type="number"
                inputMode="numeric"
                value={maxUsesPerUser}
                onChange={(event) => setMaxUsesPerUser(event.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="c-expires">Expires</Label>
            <Input
              id="c-expires"
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="mt-1.5"
            />
            <FieldHint>Leave empty for no expiry.</FieldHint>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-border pt-5">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              disabled={code.trim().length < 3 || description.trim().length < 4}
              onClick={() => save.mutate()}
            >
              {isEditing ? 'Save changes' : 'Create coupon'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
