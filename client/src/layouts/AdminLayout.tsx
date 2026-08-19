import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  QrCode,
  Receipt,
  Tag,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { cn, initials } from '@/lib/utils';

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: Receipt },
  { to: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/admin/tables', label: 'Tables & QR', icon: QrCode },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag },
];

/**
 * Admin chrome. Deliberately quieter than the storefront — a working tool, but
 * still on the same paper ground rather than generic dashboard grey.
 */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-border bg-cream/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
          <div className="flex items-center gap-5">
            <Logo />
            <span className="hidden h-6 w-px bg-border sm:block" />
            <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Administration
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button asChild variant="ghost" size="sm">
              <Link to="/kitchen">Kitchen display</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-3.5 w-3.5" />
                Storefront
              </Link>
            </Button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-espresso font-sans text-[0.6875rem] font-semibold uppercase text-cream">
              {initials(user?.name ?? '')}
            </span>
          </div>
        </div>

        {/* Section rail — scrolls horizontally on narrow screens. */}
        <nav aria-label="Admin sections" className="border-t border-border">
          <ul className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2 lg:px-7">
            {LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <li key={link.to} className="shrink-0">
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-md px-3.5 py-2 font-sans text-[0.8125rem] transition-colors',
                        isActive
                          ? 'bg-espresso text-cream'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    {link.label}
                  </NavLink>
                </li>
              );
            })}
            <li className="ml-auto hidden shrink-0 lg:block">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => void logout().then(() => navigate('/'))}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </li>
          </ul>
        </nav>
      </header>

      <main className="px-5 py-7 lg:px-8 lg:py-9">
        <Outlet />
      </main>
    </div>
  );
}
