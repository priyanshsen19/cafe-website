import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu as MenuIcon, Package, Search, ShoppingBag, User as UserIcon, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/store/ui';
import { useScrolled } from '@/hooks/useUtils';
import { cn, initials } from '@/lib/utils';

const NAV = [
  { label: 'Menu', to: '/menu' },
  { label: 'Coffee', to: '/menu/coffee' },
  { label: 'Food', to: '/menu/breakfast' },
  { label: 'About', to: '/about' },
  { label: 'Locations', to: '/locations' },
];

/**
 * Routes whose first screen is a full-bleed dark photograph. Over those, an
 * unscrolled header has to invert to light type — dark-on-dark was unreadable.
 */
const DARK_HERO_ROUTES = new Set(['/', '/about']);

export function Header() {
  const scrolled = useScrolled(16);
  const { user, isAuthenticated, isStaff, isAdmin, logout } = useAuth();
  const { data: cart } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Light type only while the header is genuinely sitting on the photograph.
  const onDark = !scrolled && DARK_HERO_ROUTES.has(pathname);

  const openCart = useUiStore((state) => state.openCart);
  const openSearch = useUiStore((state) => state.openSearch);
  const isMobileNavOpen = useUiStore((state) => state.isMobileNavOpen);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  const itemCount = cart?.itemCount ?? 0;

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-all duration-300 ease-editorial',
        // On scroll the bar tightens, gains a translucent ground and a hairline.
        scrolled
          ? 'border-b border-border bg-cream/[0.88] shadow-header backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="container">
        <div
          className={cn(
            'flex items-center justify-between gap-4 transition-all duration-300 ease-editorial',
            scrolled ? 'h-16' : 'h-20 lg:h-[5.5rem]',
          )}
        >
          {/* ── mobile: hamburger ── */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className={cn(
              '-ml-2 grid h-10 w-10 place-items-center rounded-md transition-colors lg:hidden',
              onDark ? 'text-cream hover:bg-cream/10' : 'text-foreground hover:bg-espresso/[0.06]',
            )}
            aria-label="Open navigation"
            aria-expanded={isMobileNavOpen}
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-10">
            <Logo showTagline={!scrolled} tone={onDark ? 'light' : 'dark'} />

            <nav aria-label="Main" className="hidden lg:block">
              <ul className="flex items-center gap-7">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'relative font-sans text-[0.8125rem] font-medium uppercase tracking-[0.1em] transition-colors',
                          onDark
                            ? isActive
                              ? 'text-cream'
                              : 'text-cream/70 hover:text-cream'
                            : isActive
                              ? 'text-foreground'
                              : 'text-muted-foreground hover:text-foreground',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {item.label}
                          {isActive && (
                            <motion.span
                              layoutId="nav-underline"
                              className="absolute -bottom-1.5 left-0 h-px w-full bg-terracotta"
                              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={openSearch}
              className={cn(
                'grid h-10 w-10 place-items-center rounded-md transition-colors',
                onDark ? 'text-cream hover:bg-cream/10' : 'text-foreground hover:bg-espresso/[0.06]',
              )}
              aria-label="Search the menu"
            >
              <Search className="h-[1.125rem] w-[1.125rem]" />
            </button>

            {/* ── account ── */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden h-9 w-9 place-items-center rounded-full bg-espresso font-sans text-[0.6875rem] font-semibold uppercase text-cream transition-opacity hover:opacity-90 sm:grid"
                    aria-label={`Account — ${user?.name}`}
                  >
                    {initials(user?.name ?? '')}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <span className="block font-sans text-sm font-medium text-foreground">{user?.name}</span>
                    <span className="block truncate">{user?.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/account">
                      <UserIcon />
                      My account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account/orders">
                      <Package />
                      My orders
                    </Link>
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem asChild>
                      <Link to="/kitchen">
                        <LayoutDashboard />
                        Kitchen display
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <LayoutDashboard />
                        Admin dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      void logout().then(() => navigate('/'));
                    }}
                  >
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/login"
                className={cn(
                  'hidden h-10 items-center rounded-md px-3 font-sans text-[0.8125rem] font-medium transition-colors sm:inline-flex',
                  onDark ? 'text-cream hover:bg-cream/10' : 'text-foreground hover:bg-espresso/[0.06]',
                )}
              >
                Sign in
              </Link>
            )}

            {/* ── cart ── */}
            <button
              type="button"
              onClick={openCart}
              className={cn(
                'relative grid h-10 w-10 place-items-center rounded-md transition-colors',
                onDark ? 'text-cream hover:bg-cream/10' : 'text-foreground hover:bg-espresso/[0.06]',
              )}
              aria-label={`Your order — ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
            >
              <ShoppingBag className="h-[1.125rem] w-[1.125rem]" />
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="absolute -right-0.5 -top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-terracotta px-1 font-sans text-[0.625rem] font-semibold text-cream"
                >
                  {itemCount}
                </motion.span>
              )}
            </button>

            <Button
              asChild
              size="sm"
              variant={onDark ? 'accent' : 'default'}
              className="ml-1.5 hidden md:inline-flex"
            >
              <Link to="/menu">Order Now</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── mobile navigation ── */}
      <Sheet open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" hideClose className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <SheetTitle asChild>
              <div>
                <Logo asLink={false} showTagline />
              </div>
            </SheetTitle>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-md text-foreground/60 hover:bg-espresso/[0.06]"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-0.5">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-md px-3 py-3 font-display text-lg transition-colors',
                        isActive ? 'bg-secondary text-foreground' : 'text-foreground hover:bg-secondary/60',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li className="pt-2">
                <NavLink
                  to="/contact"
                  onClick={() => setMobileNavOpen(false)}
                  className="block rounded-md px-3 py-3 font-display text-lg text-foreground hover:bg-secondary/60"
                >
                  Contact
                </NavLink>
              </li>
            </ul>

            <div className="mt-6 border-t border-border pt-5">
              {isAuthenticated ? (
                <div className="space-y-0.5">
                  <p className="px-3 pb-2 font-sans text-xs text-muted-foreground">Signed in as {user?.name}</p>
                  <Link
                    to="/account"
                    onClick={() => setMobileNavOpen(false)}
                    className="block rounded-md px-3 py-2.5 font-sans text-sm text-foreground hover:bg-secondary/60"
                  >
                    My account
                  </Link>
                  <Link
                    to="/account/orders"
                    onClick={() => setMobileNavOpen(false)}
                    className="block rounded-md px-3 py-2.5 font-sans text-sm text-foreground hover:bg-secondary/60"
                  >
                    My orders
                  </Link>
                  {isStaff && (
                    <Link
                      to="/kitchen"
                      onClick={() => setMobileNavOpen(false)}
                      className="block rounded-md px-3 py-2.5 font-sans text-sm text-foreground hover:bg-secondary/60"
                    >
                      Kitchen display
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileNavOpen(false)}
                      className="block rounded-md px-3 py-2.5 font-sans text-sm text-foreground hover:bg-secondary/60"
                    >
                      Admin dashboard
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-2 px-3">
                  <Button asChild className="w-full">
                    <Link to="/login" onClick={() => setMobileNavOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/register" onClick={() => setMobileNavOpen(false)}>
                      Create an account
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
