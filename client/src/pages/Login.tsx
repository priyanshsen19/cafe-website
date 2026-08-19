import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useSeo } from '@/hooks/useUtils';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { role: 'Customer', email: 'demo@demo-cafe.com', password: 'DemoCustomer123!' },
  { role: 'Kitchen', email: 'kitchen@demo-cafe.com', password: 'KitchenDemo123!' },
  { role: 'Admin', email: 'admin@demo-cafe.com', password: 'AdminDemo123!' },
];

export default function Login() {
  useSeo({ title: 'Sign in', canonicalPath: '/login' });

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/account';

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);

      // Staff land where they actually work.
      if (from !== '/account') navigate(from, { replace: true });
      else if (user.role === 'ADMIN') navigate('/admin', { replace: true });
      else if (user.role === 'STAFF') navigate('/kitchen', { replace: true });
      else navigate('/account', { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to sign in.';
      setError('password', { message });
      toast.error(message);
    }
  };

  return (
    <div className="container flex min-h-[80svh] items-center justify-center py-14">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Logo showTagline />
          <h1 className="mt-8 text-display-sm text-foreground">Welcome back</h1>
          <p className="mt-2.5 font-sans text-sm text-muted-foreground">
            Sign in to track orders, save favourites and reorder in one tap.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-9 space-y-5" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className="mt-1.5"
              {...register('email')}
            />
            <FieldError id="email-error">{errors.email?.message}</FieldError>
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="pr-11"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError id="password-error">{errors.password?.message}</FieldError>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center font-sans text-sm text-muted-foreground">
          New here?{' '}
          <Link to="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>

        {/* Demo credentials, so a reviewer can get in without signing up. */}
        <div className="mt-10 rounded-lg border border-border bg-card p-5">
          <p className="font-sans text-xs font-medium text-foreground">Demo accounts</p>
          <p className="mt-1 font-sans text-xs text-muted-foreground">
            This is a demonstration build. Tap one to fill the form.
          </p>
          <ul className="mt-3.5 space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => {
                    setValue('email', account.email, { shouldValidate: true });
                    setValue('password', account.password, { shouldValidate: true });
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-secondary"
                >
                  <span className="font-sans text-xs font-medium text-foreground">{account.role}</span>
                  <span className="truncate font-sans text-xs text-muted-foreground">{account.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
