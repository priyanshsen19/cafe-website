import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { paymentApi } from '@/api/endpoints';
import type { CheckoutSession } from '@/types';

/** Minimal shape of the Razorpay checkout constructor we actually use. */
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  image?: string;
  theme?: { color?: string };
  prefill?: { name?: string; email?: string; contact?: string; method?: string };
  notes?: Record<string, string>;
  /** Opens Checkout on the tab the customer already chose on our page. */
  config?: { display?: { blocks?: unknown; sequence?: string[]; preferences?: { show_default_blocks?: boolean } } };
  retry?: { enabled?: boolean };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void; confirm_close?: boolean; escape?: boolean };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/** Loads Razorpay's checkout script once, on demand. */
function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface PayResult {
  ok: boolean;
  orderId: string;
}

/**
 * Drives the payment leg of checkout. Both modes converge on the same
 * server-side verification call — the client never decides whether a payment
 * succeeded.
 */
export function usePayment() {
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [isMockOpen, setMockOpen] = useState(false);
  const [isVerifying, setVerifying] = useState(false);

  const reset = useCallback(() => {
    setSession(null);
    setMockOpen(false);
    setVerifying(false);
  }, []);

  /**
   * Starts payment for an already-created order. Resolves once the payment is
   * verified (or rejects/returns false if it wasn't completed).
   */
  const pay = useCallback(
    async (
      orderId: string,
      customer: { name: string; email: string; phone: string },
      isRetry = false,
    ): Promise<PayResult> => {
      const { session: created } = isRetry
        ? await paymentApi.retry(orderId)
        : await paymentApi.createSession(orderId);

      setSession(created);

      // ── development mode: our own sheet, real signature ──
      if (created.mode === 'mock') {
        setMockOpen(true);
        return { ok: false, orderId };
      }

      // ── live gateway ──
      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay) {
        toast.error('We couldn’t open the payment window. Please check your connection and try again.');
        await paymentApi.fail(created.providerOrderId, 'Checkout script failed to load').catch(() => undefined);
        return { ok: false, orderId };
      }

      return new Promise<PayResult>((resolve) => {
        const checkout = new window.Razorpay!({
          key: created.keyId!,
          amount: created.amount * 100,
          currency: created.currency,
          name: 'ALAAP',
          description: `Order ${created.orderNumber}`,
          order_id: created.providerOrderId,
          theme: { color: '#2A1F1A' },
          notes: { orderNumber: created.orderNumber },
          retry: { enabled: true },
          // Identity only — the card number, CVV and UPI PIN are typed into
          // Razorpay's own hosted form, never ours.
          prefill: {
            name: created.prefill?.name ?? customer.name,
            email: created.prefill?.email ?? customer.email,
            contact: created.prefill?.contact ?? customer.phone,
            // Opens Checkout on the method the customer already picked.
            ...(created.method ? { method: created.method } : {}),
          },
          handler: (response) => {
            setVerifying(true);
            paymentApi
              .verify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              })
              .then(() => resolve({ ok: true, orderId }))
              .catch((cause: Error) => {
                toast.error(cause.message);
                resolve({ ok: false, orderId });
              })
              .finally(() => setVerifying(false));
          },
          modal: {
            // Ask before discarding a payment in progress.
            confirm_close: true,
            ondismiss: () => {
              void paymentApi
                .fail(created.providerOrderId, 'Payment window closed')
                .catch(() => undefined);
              toast.error('Payment wasn’t completed, so your order hasn’t been placed. You can pay again from your orders.');
              resolve({ ok: false, orderId });
            },
          },
        });

        checkout.open();
      });
    },
    [],
  );

  /** Confirms the mock payment through the real verification endpoint. */
  const confirmMock = useCallback(
    async (paymentId: string, signature: string): Promise<boolean> => {
      if (!session) return false;
      setVerifying(true);
      try {
        await paymentApi.verify({
          razorpayOrderId: session.providerOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        });
        setMockOpen(false);
        return true;
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : 'Payment could not be verified.');
        return false;
      } finally {
        setVerifying(false);
      }
    },
    [session],
  );

  /** Sends a deliberately invalid signature, exercising the rejection path. */
  const failMock = useCallback(async (): Promise<void> => {
    if (!session) return;
    setVerifying(true);
    try {
      await paymentApi.verify({
        razorpayOrderId: session.providerOrderId,
        razorpayPaymentId: session.mockPaymentId ?? 'mock_pay_invalid',
        razorpaySignature: 'invalid-signature',
      });
    } catch {
      toast.error('Payment could not be completed. Please try again.');
    } finally {
      setVerifying(false);
      setMockOpen(false);
    }
  }, [session]);

  const cancelMock = useCallback(async () => {
    if (session) {
      await paymentApi.fail(session.providerOrderId, 'Cancelled by customer').catch(() => undefined);
    }
    setMockOpen(false);
    toast.error('Payment cancelled. Your order is saved — you can pay from your orders.');
  }, [session]);

  return { session, isMockOpen, isVerifying, pay, confirmMock, failMock, cancelMock, reset };
}

/**
 * The online methods the gateway will actually accept right now.
 *
 * Availability is an account setting on the gateway's side, so the answer can
 * change without this app changing — the checkout asks rather than assumes,
 * and a method switched on in the dashboard shows up here on its own.
 */
export function useEnabledPaymentMethods() {
  return useQuery({
    queryKey: ['payments', 'methods'],
    queryFn: () => paymentApi.methods(),
    staleTime: 5 * 60_000,
  });
}
