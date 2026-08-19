import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Heart, LogOut, MapPin, Package, Shield, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn, initials } from '@/lib/utils';

const LINKS = [
  { to: '/account', label: 'Overview', icon: UserIcon, end: true },
  { to: '/account/orders', label: 'Orders', icon: Package },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/account/wishlist', label: 'Favourites', icon: Heart },
  { to: '/account/profile', label: 'Profile', icon: UserIcon },
  { to: '/account/security', label: 'Security', icon: Shield },
];

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="container py-10 lg:py-14">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-espresso font-sans text-base font-semibold uppercase text-cream">
          {initials(user?.name ?? '')}
        </span>
        <div>
          <h1 className="text-display-sm text-foreground">{user?.name}</h1>
          <p className="mt-1 font-sans text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[13rem_1fr] lg:gap-14">
        {/* ── section nav: sidebar on desktop, scrolling rail on mobile ── */}
        <nav aria-label="Account sections">
          <ul className="no-scrollbar flex gap-1.5 overflow-x-auto lg:sticky lg:top-28 lg:flex-col lg:gap-0.5 lg:overflow-visible">
            {LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <li key={link.to} className="shrink-0">
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-3.5 py-2.5 font-sans text-sm transition-colors',
                        isActive
                          ? 'bg-secondary font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    {link.label}
                  </NavLink>
                </li>
              );
            })}
            <li className="hidden pt-3 lg:block">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-3.5 text-muted-foreground"
                onClick={() => void logout().then(() => navigate('/'))}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </li>
          </ul>
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
