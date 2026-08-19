import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Check, Clock, Lock, QrCode, ShoppingBag, Store, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem, Separator } from '@/components/ui/form-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/States';
import { OrderTypeSelector } from '@/components/checkout/OrderTypeSelector';
import { PaymentMethods, methodsFor } from '@/components/checkout/PaymentMethods';
import { AddressPicker } from '@/components/checkout/AddressPicker';
import { MockGateway } from '@/components/checkout/MockGateway';
import { accountApi, orderApi, publicApi } from '@/api/endpoints';
import { useCart } from '@/hooks/useCart';
import { usePayment } from '@/hooks/usePayment';
import { useAuth } from '@/contexts/AuthContext';
import { useDineIn } from '@/contexts/DineInContext';
import { useSeo } from '@/hooks/useUtils';
import { cartKeys } from '@/hooks/useCart';
import { cn, formatINR, formatTime } from '@/lib/utils';
import type { DeliverySpeed, Order, OrderType, PaymentMethod } from '@/types';

/** Half-hour slots for the next twelve hours, for scheduled orders. */
function buildTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  const start = new Date();
  start.setMinutes(start.getMinutes() + 45, 0, 0);
  start.setMinutes(start.getMinutes() < 30 ? 0 : 30);

  for (let index = 0; index < 24; index += 1) {
    const slot = new Date(start.getTime() + index * 30 * 60_000);
    const hour = slot.getHours();
    // Only offer slots inside trading hours (8:00 to 23:00).
    if (hour < 8 || hour >= 23) continue;
    slots.push({ value: slot.toISOString(), label: formatTime(slot) });
  }

  return slots;
}

export default function Checkout() {
  useSeo({ title: 'Checkout', canonicalPath: '/checkout' });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { session: tableSession } = useDineIn();
  const payment = usePayment();

  // ── selections ──
  const [orderType, setOrderType] = useState<OrderType>(tableSession ? 'DINE_IN' : 'DELIVERY');
  const [addressId, setAddressId] = useState<string | null>(null);
  const [cafeId, setCafeId] = useState<string | null>(null);
  const [deliverySpeed, setDeliverySpeed] = useState<DeliverySpeed>('STANDARD');
  const [timing, setTiming] = useState<'ASAP' | 'SCHEDULED'>('ASAP');
  const [scheduledFor, setScheduledFor] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  /**
   * The order we're currently collecting payment for.
   *
   * Placing an order empties the cart, so from that moment the cart-derived
   * summary reads ₹0 — while the payment sheet in front of it asks for the real
   * amount. Holding the created order lets the page keep showing what is
   * actually being charged.
   */
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null);

  const timeSlots = useMemo(buildTimeSlots, []);

  // Totals always come from the server, priced for the current selections.
  const { data: cart, isLoading: isCartLoading } = useCart({
    orderType,
    couponCode: appliedCoupon,
    deliverySpeed,
    // Re-prices when the method changes: online payments carry a gateway fee.
    paymentMethod,
  });

  const { data: cafes } = useQuery({
    queryKey: ['cafes'],
    queryFn: () => publicApi.cafes().then((response) => response.cafes),
  });

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => accountApi.addresses().then((response) => response.addresses),
  });

  const { data: serviceStatus } = useQuery({
    queryKey: ['service-status'],
    queryFn: () => publicApi.serviceStatus(),
  });

  // Sensible defaults once data arrives.
  useEffect(() => {
    if (!addressId && addresses?.length) {
      setAddressId((addresses.find((address) => address.isDefault) ?? addresses[0])!.id);
    }
  }, [addresses, addressId]);

  useEffect(() => {
    if (tableSession) {
      setOrderType('DINE_IN');
      setCafeId(tableSession.cafe.id);
    } else if (!cafeId && cafes?.length) {
      setCafeId(cafes[0]!.id);
    }
  }, [cafes, cafeId, tableSession]);

  // Keep the payment method valid whenever the fulfilment type changes.
  useEffect(() => {
    const allowed = methodsFor(orderType);
    if (!allowed.includes(paymentMethod)) setPaymentMethod(allowed[0]!);
  }, [orderType, paymentMethod]);

  // A closed café can only take scheduled orders.
  const isClosed = serviceStatus ? !serviceStatus.isOpen : false;
  useEffect(() => {
    if (isClosed && timing === 'ASAP') setTiming('SCHEDULED');
  }, [isClosed, timing]);

  // Choosing "schedule" without a slot leaves the customer stuck: the pay
  // button is disabled and nothing visibly explains why. Preselecting the
  // earliest slot means there is always a valid time — they can still pick a
  // different one — so the order is never blocked by an unmade choice.
  useEffect(() => {
    if (timing === 'SCHEDULED' && !scheduledFor && timeSlots.length > 0) {
      setScheduledFor(timeSlots[0]!.value);
    }
  }, [timing, scheduledFor, timeSlots]);

  const applyCoupon = useMutation({
    mutationFn: (code: string) => publicApi.previewCoupon(code, cart?.totals.subtotal ?? 0),
    onSuccess: (result) => {
      setAppliedCoupon(result.coupon.code);
      setCouponInput('');
      toast.success(`${result.coupon.code} applied — ${formatINR(result.coupon.discount)} off`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const placeOrder = useMutation({
    mutationFn: () =>
      orderApi
        .create({
          orderType,
          addressId: orderType === 'DELIVERY' ? (addressId ?? undefined) : undefined,
          cafeId: orderType === 'PICKUP' ? (cafeId ?? undefined) : undefined,
          tableToken: orderType === 'DINE_IN' ? tableSession?.table.qrToken : undefined,
          scheduledFor: timing === 'SCHEDULED' && scheduledFor ? scheduledFor : undefined,
          deliverySpeed: orderType === 'DELIVERY' ? deliverySpeed : undefined,
          paymentMethod,
          couponCode: appliedCoupon,
          notes: notes.trim() || undefined,
        })
        .then((response) => response.order),
    onSuccess: async (order) => {
      void queryClient.invalidateQueries({ queryKey: cartKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });

      const isCashLike = paymentMethod === 'COD' || paymentMethod === 'PAY_AT_COUNTER';
      if (isCashLike) {
        toast.success('Order confirmed');
        navigate(`/orders/${order.id}/success`, { replace: true });
        return;
      }

      // Online payment: hand off to the gateway, then verify server-side.
      setPendingOrderId(order.id);
      setSettlingOrder(order);
      const result = await payment.pay(order.id, {
        name: order.contactName,
        email: user?.email ?? '',
        phone: order.contactPhone,
      });

      if (result.ok) {
        toast.success('Payment received — order confirmed');
        navigate(`/orders/${order.id}/success`, { replace: true });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // While a payment is in flight the cart is already empty server-side, so fall
  // back to the order being paid for — the customer must never see ₹0 behind a
  // sheet asking them for real money.
  const totals = settlingOrder
    ? {
        subtotal: settlingOrder.subtotal,
        discount: settlingOrder.discount,
        tax: settlingOrder.tax,
        deliveryFee: settlingOrder.deliveryFee,
        paymentFee: settlingOrder.paymentFee,
        total: settlingOrder.total,
        taxRatePercent: cart?.totals.taxRatePercent ?? 5,
        freeDeliveryThreshold: cart?.totals.freeDeliveryThreshold ?? 0,
        amountToFreeDelivery: 0,
      }
    : cart?.totals;

  const lines = settlingOrder
    ? settlingOrder.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        subtotal: item.subtotal,
        modifierSummary: item.modifierSummary,
      }))
    : (cart?.lines ?? []);

  const unavailable = settlingOrder ? [] : (cart?.unavailableLines ?? []);

  // ── gating ──
  const blockers: string[] = [];
  if (unavailable.length > 0) blockers.push('Remove unavailable items from your cart');
  if (orderType === 'DELIVERY' && !addressId) blockers.push('Choose a delivery address');
  if (orderType === 'PICKUP' && !cafeId) blockers.push('Choose a pickup location');
  if (orderType === 'DINE_IN' && !tableSession) blockers.push('Scan your table QR code');
  if (timing === 'SCHEDULED' && !scheduledFor) blockers.push('Choose a time');

  const canPlace = blockers.length === 0 && lines.length > 0 && !placeOrder.isPending;

  if (isCartLoading) {
    return (
      <div className="container py-12">
        <Skeleton className="h-10 w-56" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <Skeleton className="h-36 rounded-lg" />
            <Skeleton className="h-56 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  // Placing an order deliberately empties the cart server-side. If the empty
  // state were shown on that basis alone, this component would unmount the
  // moment the order was created — taking the payment sheet with it and
  // stranding the customer with an unpaid order. Stay mounted until payment
  // resolves and we navigate to the confirmation page.
  const isSettlingPayment = Boolean(pendingOrderId) || placeOrder.isPending;

  if (lines.length === 0 && unavailable.length === 0 && !isSettlingPayment) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={ShoppingBag}
          title="There’s nothing to check out"
          description="Your cart is empty. Have a look at what we’re making today."
          action={{ label: 'Explore the menu', to: '/menu' }}
          className="rounded-lg border border-border bg-card"
        />
      </div>
    );
  }

  return (
    <div className="container py-10 lg:py-14">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-3 text-display-sm text-foreground">How would you like to enjoy your order?</h1>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
        <div className="space-y-9">
          {/* ── 1. order type ── */}
          <section aria-labelledby="step-type">
            <h2 id="step-type" className="mb-4 font-display text-xl text-foreground">
              <span className="mr-2 text-muted-foreground">1.</span>
              Order type
            </h2>
            <OrderTypeSelector
              value={orderType}
              onChange={setOrderType}
              dineInAvailable={Boolean(tableSession)}
              tableLabel={tableSession?.table.label}
            />
          </section>

          {/* ── 2. destination ── */}
          <section aria-labelledby="step-where">
            <h2 id="step-where" className="mb-4 font-display text-xl text-foreground">
              <span className="mr-2 text-muted-foreground">2.</span>
              {orderType === 'DELIVERY' ? 'Delivery address' : orderType === 'PICKUP' ? 'Pickup location' : 'Your table'}
            </h2>

            {orderType === 'DELIVERY' && (
              <>
                <AddressPicker selectedId={addressId} onSelect={setAddressId} />

                <div className="mt-6">
                  <h3 className="mb-3 font-sans text-[0.9375rem] font-medium text-foreground">Delivery speed</h3>
                  <RadioGroup
                    value={deliverySpeed}
                    onValueChange={(value) => setDeliverySpeed(value as DeliverySpeed)}
                    className="grid gap-2.5 sm:grid-cols-2"
                  >
                    {(
                      [
                        { value: 'STANDARD', title: 'Standard', hint: '25–35 min', note: 'Free over ₹499' },
                        { value: 'EXPRESS', title: 'Express', hint: '15–22 min', note: 'Priority dispatch' },
                      ] as const
                    ).map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors',
                          deliverySpeed === option.value
                            ? 'border-espresso bg-secondary/70'
                            : 'border-border bg-card hover:border-espresso/35',
                        )}
                      >
                        <RadioGroupItem value={option.value} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-sans text-sm font-medium text-foreground">{option.title}</span>
                          <span className="block font-sans text-xs text-muted-foreground">
                            {option.hint} · {option.note}
                          </span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </>
            )}

            {orderType === 'PICKUP' && (
              <RadioGroup
                value={cafeId ?? ''}
                onValueChange={setCafeId}
                className="gap-2.5"
                aria-label="Pickup location"
              >
                {(cafes ?? []).map((cafe) => (
                  <label
                    key={cafe.id}
                    className={cn(
                      'flex cursor-pointer gap-3.5 rounded-lg border p-4 transition-colors',
                      cafeId === cafe.id
                        ? 'border-espresso bg-secondary/70'
                        : 'border-border bg-card hover:border-espresso/35',
                    )}
                  >
                    <RadioGroupItem value={cafe.id} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans text-sm font-medium text-foreground">{cafe.name}</span>
                        <Badge variant={cafe.openState.isOpen ? 'olive' : 'subtle'} size="sm">
                          {cafe.openState.isOpen ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                      <p className="mt-1.5 font-sans text-[0.8125rem] text-muted-foreground">
                        {cafe.line1}, {cafe.city}
                      </p>
                    </div>
                    <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </label>
                ))}
              </RadioGroup>
            )}

            {orderType === 'DINE_IN' &&
              (tableSession ? (
                <div className="flex items-start gap-3.5 rounded-lg border border-espresso bg-secondary/70 p-5">
                  <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" aria-hidden />
                  <div>
                    <p className="font-display text-lg text-foreground">Table {tableSession.table.label}</p>
                    <p className="mt-1 font-sans text-sm text-muted-foreground">
                      {tableSession.cafe.name} · {tableSession.table.floor} · seats {tableSession.table.capacity}
                    </p>
                    <p className="mt-2.5 font-sans text-xs text-muted-foreground">
                      No address needed — we’ll bring everything to you.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
                  <p className="font-sans text-sm text-foreground">No table attached</p>
                  <p className="mt-1 font-sans text-xs text-muted-foreground">
                    Scan the QR code on your table to order from your seat.
                  </p>
                </div>
              ))}
          </section>

          {/* ── 3. timing ── */}
          <section aria-labelledby="step-when">
            <h2 id="step-when" className="mb-4 font-display text-xl text-foreground">
              <span className="mr-2 text-muted-foreground">3.</span>
              When
            </h2>

            {isClosed && (
              <div className="mb-4 flex gap-3 rounded-md border border-terracotta/25 bg-terracotta/[0.06] p-4">
                <Clock className="mt-px h-4 w-4 shrink-0 text-terracotta" aria-hidden />
                <div>
                  <p className="font-sans text-sm font-medium text-foreground">We’re currently closed.</p>
                  <p className="mt-1 font-sans text-[0.8125rem] text-muted-foreground">
                    You can schedule your order for when we open again.
                  </p>
                </div>
              </div>
            )}

            <RadioGroup
              value={timing}
              onValueChange={(value) => setTiming(value as 'ASAP' | 'SCHEDULED')}
              className="grid gap-2.5 sm:grid-cols-2"
            >
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors',
                  timing === 'ASAP' ? 'border-espresso bg-secondary/70' : 'border-border bg-card hover:border-espresso/35',
                  isClosed && 'cursor-not-allowed opacity-45',
                )}
              >
                <RadioGroupItem value="ASAP" disabled={isClosed} />
                <span>
                  <span className="block font-sans text-sm font-medium text-foreground">As soon as possible</span>
                  <span className="block font-sans text-xs text-muted-foreground">
                    {orderType === 'DELIVERY' ? 'Arrives in 25–35 min' : 'Ready in about 15 min'}
                  </span>
                </span>
              </label>

              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors',
                  timing === 'SCHEDULED'
                    ? 'border-espresso bg-secondary/70'
                    : 'border-border bg-card hover:border-espresso/35',
                )}
              >
                <RadioGroupItem value="SCHEDULED" />
                <span>
                  <span className="block font-sans text-sm font-medium text-foreground">Schedule for later</span>
                  <span className="block font-sans text-xs text-muted-foreground">Pick a time that suits you</span>
                </span>
              </label>
            </RadioGroup>

            {timing === 'SCHEDULED' && (
              <div className="mt-4">
                <Label htmlFor="slot">Choose a time</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {timeSlots.length === 0 && (
                    <p className="font-sans text-sm text-muted-foreground">
                      No slots left today — please try again tomorrow morning.
                    </p>
                  )}
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setScheduledFor(slot.value)}
                      aria-pressed={scheduledFor === slot.value}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 font-sans text-xs tabular-nums transition-colors',
                        scheduledFor === slot.value
                          ? 'border-espresso bg-espresso text-cream'
                          : 'border-border bg-card text-foreground hover:border-espresso/40',
                      )}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── 4. payment ── */}
          <section aria-labelledby="step-pay">
            <h2 id="step-pay" className="mb-4 font-display text-xl text-foreground">
              <span className="mr-2 text-muted-foreground">4.</span>
              Payment
            </h2>
            <PaymentMethods
              orderType={orderType}
              value={paymentMethod}
              onChange={setPaymentMethod}
              paymentMode={payment.session?.mode ?? 'mock'}
            />

            <div className="mt-5">
              <Label htmlFor="order-notes">Notes for the kitchen (optional)</Label>
              <Textarea
                id="order-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Allergies, gate code, cutlery…"
                maxLength={300}
                className="mt-1.5"
              />
            </div>
          </section>
        </div>

        {/* ── summary ── */}
        <aside className="lg:sticky lg:top-28">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-display text-xl text-foreground">Order summary</h2>

            <ul className="mt-5 space-y-3.5">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-3">
                  <span className="mt-0.5 font-sans text-xs tabular-nums text-muted-foreground">{line.quantity}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-sans text-[0.8125rem] font-medium leading-snug text-foreground">
                      {line.name}
                    </span>
                    {line.modifierSummary && (
                      <span className="mt-0.5 block font-sans text-xs leading-relaxed text-muted-foreground">
                        {line.modifierSummary}
                      </span>
                    )}
                  </span>
                  <span className="font-sans text-[0.8125rem] tabular-nums text-foreground">
                    {formatINR(line.subtotal)}
                  </span>
                </li>
              ))}
            </ul>

            {unavailable.length > 0 && (
              <div role="alert" className="mt-4 flex gap-2.5 rounded-md border border-destructive/25 bg-destructive/[0.04] p-3">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
                <p className="font-sans text-xs text-foreground">
                  {unavailable.map((line) => line.name).join(', ')} {unavailable.length === 1 ? 'is' : 'are'} unavailable.{' '}
                  <Link to="/cart" className="font-medium underline">
                    Update your cart
                  </Link>
                </p>
              </div>
            )}

            <Separator className="my-5" />

            {/* ── coupon ── */}
            {appliedCoupon ? (
              <div className="flex items-center justify-between gap-3 rounded-md bg-olive/10 px-3.5 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-olive" aria-hidden />
                  <span className="truncate font-sans text-xs font-medium text-olive">{appliedCoupon} applied</span>
                </span>
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(undefined)}
                  className="shrink-0 rounded p-1 text-olive/70 transition-colors hover:text-olive"
                  aria-label="Remove coupon"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                    placeholder="Promo code"
                    aria-label="Promo code"
                    className="h-10 pl-9 text-sm uppercase"
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-10"
                  disabled={couponInput.trim().length < 3}
                  loading={applyCoupon.isPending}
                  onClick={() => applyCoupon.mutate(couponInput.trim())}
                >
                  Apply
                </Button>
              </div>
            )}

            {totals && (
              <>
                <dl className="mt-5 space-y-3 font-sans text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums text-foreground">{formatINR(totals.subtotal)}</dd>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-olive">
                      <dt>Discount</dt>
                      <dd className="tabular-nums">−{formatINR(totals.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">GST ({totals.taxRatePercent}%)</dt>
                    <dd className="tabular-nums text-foreground">{formatINR(totals.tax)}</dd>
                  </div>
                  {orderType === 'DELIVERY' && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        Delivery{deliverySpeed === 'EXPRESS' ? ' (express)' : ''}
                      </dt>
                      <dd className="tabular-nums text-foreground">
                        {totals.deliveryFee === 0 ? <span className="text-olive">Free</span> : formatINR(totals.deliveryFee)}
                      </dd>
                    </div>
                  )}
                  {totals.paymentFee > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Payment processing</dt>
                      <dd className="tabular-nums text-foreground">{formatINR(totals.paymentFee)}</dd>
                    </div>
                  )}
                </dl>

                <Separator className="my-5" />

                <div className="flex items-baseline justify-between">
                  <span className="font-display text-lg text-foreground">Total</span>
                  <span className="font-display text-2xl tabular-nums text-foreground">{formatINR(totals.total)}</span>
                </div>

                {totals.amountToFreeDelivery > 0 && orderType === 'DELIVERY' && (
                  <p className="mt-4 rounded-md bg-olive/10 px-3.5 py-2.5 font-sans text-xs text-olive">
                    Add {formatINR(totals.amountToFreeDelivery)} more and delivery is free.
                  </p>
                )}
              </>
            )}

            <Button
              size="lg"
              className="mt-6 w-full"
              disabled={!canPlace}
              loading={placeOrder.isPending || payment.isVerifying}
              onClick={() => placeOrder.mutate()}
            >
              <Lock className="h-4 w-4" />
              {paymentMethod === 'COD' || paymentMethod === 'PAY_AT_COUNTER'
                ? 'Place order'
                : `Pay ${totals ? formatINR(totals.total) : ''}`}
              <ArrowRight className="h-4 w-4" />
            </Button>

            {/* A disabled button with no visible reason reads as a broken page.
                State plainly what is still outstanding. */}
            {blockers.length > 0 && (
              <div
                role="status"
                className="mt-3.5 flex gap-2.5 rounded-md border border-terracotta/25 bg-terracotta/[0.06] p-3"
              >
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-terracotta" aria-hidden />
                <div>
                  <p className="font-sans text-xs font-medium text-foreground">
                    {blockers.length === 1 ? 'One more thing' : `${blockers.length} things left`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {blockers.map((blocker) => (
                      <li key={blocker} className="font-sans text-xs text-muted-foreground">
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <p className="mt-4 text-center font-sans text-xs leading-relaxed text-muted-foreground">
              Prices, discounts and totals are calculated on our server. Payments are verified before an order is
              confirmed.
            </p>
          </div>
        </aside>
      </div>

      <MockGateway
        session={payment.session}
        open={payment.isMockOpen}
        isVerifying={payment.isVerifying}
        onConfirm={(paymentId, signature) => {
          void payment.confirmMock(paymentId, signature).then((ok) => {
            if (ok && pendingOrderId) {
              toast.success('Payment received — order confirmed');
              navigate(`/orders/${pendingOrderId}/success`, { replace: true });
            }
          });
        }}
        onFail={() => {
          void payment.failMock().then(() => {
            if (pendingOrderId) navigate(`/orders/${pendingOrderId}/success`, { replace: true });
          });
        }}
        onCancel={() => {
          void payment.cancelMock().then(() => {
            if (pendingOrderId) navigate(`/orders/${pendingOrderId}/success`, { replace: true });
          });
        }}
      />
    </div>
  );
}
