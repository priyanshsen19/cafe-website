import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, FieldHint, Label } from '@/components/ui/label';
import { authApi } from '@/api/endpoints';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/hooks/useUtils';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords don’t match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function AccountSecurity() {
  useSeo({ title: 'Security', canonicalPath: '/account/security' });

  const navigate = useNavigate();
  const { logout } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const change = useMutation({
    mutationFn: (values: FormValues) => authApi.changePassword(values),
    onSuccess: async (result) => {
      toast.success(result.message);
      // Every other session was revoked server-side, so sign out here too.
      await logout();
      navigate('/login', { replace: true });
    },
    onError: (error: Error) => {
      setError('currentPassword', { message: error.message });
      toast.error(error.message);
    },
  });

  return (
    <div className="max-w-xl">
      <h2 className="font-display text-2xl text-foreground">Security</h2>
      <p className="mt-2 font-sans text-sm text-muted-foreground">
        Change your password. Doing so signs you out everywhere else.
      </p>

      <form onSubmit={handleSubmit((values) => change.mutate(values))} className="mt-8 space-y-5" noValidate>
        <div>
          <Label htmlFor="s-current">Current password</Label>
          <Input
            id="s-current"
            type="password"
            autoComplete="current-password"
            className="mt-1.5"
            invalid={Boolean(errors.currentPassword)}
            {...register('currentPassword')}
          />
          <FieldError>{errors.currentPassword?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="s-new">New password</Label>
          <Input
            id="s-new"
            type="password"
            autoComplete="new-password"
            className="mt-1.5"
            invalid={Boolean(errors.newPassword)}
            {...register('newPassword')}
          />
          <FieldError>{errors.newPassword?.message}</FieldError>
          {!errors.newPassword && <FieldHint>At least 8 characters, with a letter and a number.</FieldHint>}
        </div>

        <div>
          <Label htmlFor="s-confirm">Confirm new password</Label>
          <Input
            id="s-confirm"
            type="password"
            autoComplete="new-password"
            className="mt-1.5"
            invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </div>

        <Button type="submit" loading={change.isPending}>
          Update password
        </Button>
      </form>

      <div className="mt-10 flex gap-3.5 rounded-lg border border-border bg-card p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-olive" aria-hidden />
        <div>
          <p className="font-sans text-sm font-medium text-foreground">How we handle your credentials</p>
          <p className="mt-1.5 font-sans text-[0.8125rem] leading-relaxed text-muted-foreground">
            Passwords are hashed with bcrypt and never stored in readable form — not even our own staff tools can display
            them. Sessions use short-lived access tokens with rotating refresh tokens, and we never store card numbers,
            CVVs or UPI PINs.
          </p>
        </div>
      </div>
    </div>
  );
}
