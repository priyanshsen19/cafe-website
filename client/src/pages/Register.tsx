import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, FieldHint, Label } from '@/components/ui/label';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/hooks/useUtils';

/** Mirrors the server's password policy so the customer sees it before submit. */
const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name').max(80),
    email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .regex(/^[+]?[0-9\s-]{10,15}$/, 'Enter a valid phone number'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords don’t match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function Register() {
  useSeo({ title: 'Create an account', canonicalPath: '/register' });

  const { register: signUp } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const user = await signUp(values);
      toast.success(`Welcome to ALAAP, ${user.name.split(' ')[0]}`);
      navigate('/account', { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to create your account.';
      setError('email', { message });
      toast.error(message);
    }
  };

  return (
    <div className="container flex min-h-[80svh] items-center justify-center py-14">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Logo showTagline />
          <h1 className="mt-8 text-display-sm text-foreground">Create an account</h1>
          <p className="mt-2.5 font-sans text-sm text-muted-foreground">
            Save addresses, track orders and reorder your usual in one tap.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-9 space-y-5" noValidate>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Priyansh Sen"
              invalid={Boolean(errors.name)}
              className="mt-1.5"
              {...register('name')}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              invalid={Boolean(errors.email)}
              className="mt-1.5"
              {...register('email')}
            />
            <FieldError>{errors.email?.message}</FieldError>
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98450 11223"
              invalid={Boolean(errors.phone)}
              className="mt-1.5"
              {...register('phone')}
            />
            <FieldError>{errors.phone?.message}</FieldError>
            {!errors.phone && <FieldHint>So the kitchen can reach you about your order.</FieldHint>}
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(errors.password)}
              className="mt-1.5"
              {...register('password')}
            />
            <FieldError>{errors.password?.message}</FieldError>
            {!errors.password && <FieldHint>At least 8 characters, with a letter and a number.</FieldHint>}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(errors.confirmPassword)}
              className="mt-1.5"
              {...register('confirmPassword')}
            />
            <FieldError>{errors.confirmPassword?.message}</FieldError>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center font-sans text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
