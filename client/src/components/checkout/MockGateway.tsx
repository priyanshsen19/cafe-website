import { useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/form-controls';
import { formatINR } from '@/lib/utils';
import type { CheckoutSession } from '@/types';

/**
 * Stand-in for the Razorpay checkout sheet, used when PAYMENT_MODE=mock.
 *
 * It is not a shortcut around verification: the server issues a real HMAC
 * signature for the mock order, and "Pay now" submits it through the same
 * /payments/verify endpoint that a live Razorpay callback would. "Simulate a
 * failed payment" sends a deliberately invalid signature so the failure path is
 * exercised too. Mock mode cannot be enabled in production.
 */
export function MockGateway({
  session,
  open,
  onConfirm,
  onFail,
  onCancel,
  isVerifying,
}: {
  session: CheckoutSession | null;
  open: boolean;
  onConfirm: (paymentId: string, signature: string) => void;
  onFail: () => void;
  onCancel: () => void;
  isVerifying: boolean;
}) {
  const [choice, setChoice] = useState<'success' | 'failure' | null>(null);

  if (!session) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isVerifying) {
          setChoice(null);
          onCancel();
        }
      }}
    >
      <DialogContent size="sm" hideClose className="p-0">
        <div className="border-b border-border bg-secondary/60 px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-lg">Payment</DialogTitle>
            <Badge variant="subtle" size="sm">
              Development mode
            </Badge>
          </div>
          <DialogDescription className="mt-1.5 text-xs">
            A simulated gateway. No card details are collected and no money moves.
          </DialogDescription>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-baseline justify-between">
            <span className="font-sans text-sm text-muted-foreground">Order {session.orderNumber}</span>
            <span className="font-display text-2xl text-foreground tabular-nums">{formatINR(session.amount)}</span>
          </div>

          <Separator className="my-5" />

          <p className="font-sans text-xs leading-relaxed text-muted-foreground">
            The server has signed this attempt with a real HMAC. Whichever button you press, the response is verified
            server-side before the order is marked paid — exactly as a live Razorpay callback would be.
          </p>

          <div className="mt-6 grid gap-2.5">
            <Button
              size="lg"
              className="w-full"
              loading={isVerifying && choice === 'success'}
              disabled={isVerifying}
              onClick={() => {
                setChoice('success');
                onConfirm(session.mockPaymentId!, session.mockSignature!);
              }}
            >
              <Lock className="h-4 w-4" />
              Pay {formatINR(session.amount)}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              loading={isVerifying && choice === 'failure'}
              disabled={isVerifying}
              onClick={() => {
                setChoice('failure');
                onFail();
              }}
            >
              <ShieldAlert className="h-4 w-4" />
              Simulate a failed payment
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              disabled={isVerifying}
              onClick={() => {
                setChoice(null);
                onCancel();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
