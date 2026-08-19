import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, FieldHint, Label } from '@/components/ui/label';
import { authApi } from '@/api/endpoints';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/hooks/useUtils';
import { formatDate } from '@/lib/utils';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s-]{10,15}$/, 'Enter a valid phone number'),
});

type FormValues = z.infer<typeof schema>;

export default function AccountProfile() {
  useSeo({ title: 'My profile', canonicalPath: '/account/profile' });

  const { user, refreshUser } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: user ? { name: user.name, phone: user.phone } : undefined,
  });

  const save = useMutation({
    mutationFn: (values: FormValues) => authApi.updateProfile(values),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Profile updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="max-w-xl">
      <h2 className="font-display text-2xl text-foreground">Profile</h2>
      <p className="mt-2 font-sans text-sm text-muted-foreground">
        Your name and number are what the kitchen and the rider see.
      </p>

      <form onSubmit={handleSubmit((values) => save.mutate(values))} className="mt-8 space-y-5" noValidate>
        <div>
          <Label htmlFor="p-name">Full name</Label>
          <Input id="p-name" className="mt-1.5" invalid={Boolean(errors.name)} {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="p-phone">Phone</Label>
          <Input id="p-phone" type="tel" className="mt-1.5" invalid={Boolean(errors.phone)} {...register('phone')} />
          <FieldError>{errors.phone?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="p-email">Email</Label>
          <Input id="p-email" value={user?.email ?? ''} disabled className="mt-1.5" />
          <FieldHint>Your email is the identity on your account and can’t be changed here.</FieldHint>
        </div>

        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          Save changes
        </Button>
      </form>

      <div className="mt-10 border-t border-border pt-6">
        <p className="font-sans text-xs text-muted-foreground">
          Member since {user ? formatDate(user.createdAt) : '—'}
        </p>
      </div>
    </div>
  );
}
