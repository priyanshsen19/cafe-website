import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { RatingInput } from '@/components/common/Rating';
import { accountApi } from '@/api/endpoints';

/**
 * Leave a review. The server only accepts one for a dish the customer has
 * actually received, and marks it as a verified order.
 */
export function ReviewDialog({
  product,
  open,
  onOpenChange,
}: {
  product: { id: string; name: string; image: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRating(5);
      setTitle('');
      setComment('');
      setError(null);
    }
  }, [open, product?.id]);

  const submit = useMutation({
    mutationFn: () =>
      accountApi.createReview({
        productId: product!.id,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['product'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(result.updated ? 'Your review was updated' : 'Thank you — your review is live');
      onOpenChange(false);
    },
    onError: (cause: Error) => {
      setError(cause.message);
      toast.error(cause.message);
    },
  });

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>How was the {product.name.toLowerCase()}?</DialogTitle>
          <DialogDescription>
            Your review appears on the dish, marked as a verified order.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="media h-16 w-16 shrink-0 rounded-md">
              <img src={product.image} alt="" width={128} height={128} />
            </div>
            <div>
              <p className="mb-2 font-sans text-[0.8125rem] font-medium text-foreground">Your rating</p>
              <RatingInput value={rating} onChange={setRating} />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="review-title">Title (optional)</Label>
              <Input
                id="review-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Best in the city"
                maxLength={80}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="review-comment">Your review</Label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  setError(null);
                }}
                placeholder="What did you think? Would you order it again?"
                maxLength={1000}
                rows={5}
                invalid={Boolean(error)}
                className="mt-1.5"
              />
              <FieldError>{error}</FieldError>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              loading={submit.isPending}
              disabled={comment.trim().length < 4}
              onClick={() => submit.mutate()}
            >
              Post review
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
