import { Link, NavLink, useLocation } from 'react-router-dom';
import { Home, Package, Search, User as UserIcon, UtensilsCrossed } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCart } from '@/hooks/useCart';
import { useUiStore } from '@/store/ui';
import { cn, formatINR } from '@/lib/utils';

const TABS = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Menu', to: '/menu', icon: UtensilsCrossed },
  { label: 'Search', to: '/search', icon: Search, isSearch: true },
  { label: 'Orders', to: '/account/orders', icon: Package },
  { label: 'Account', to: '/account', icon: UserIcon },
];

/**
 * Mobile bottom navigation, plus a floating bar that surfaces the running order
 * so the cart stays reachable without occupying a tab slot.
 */
export function MobileNav() {
  const { data: cart } = useCart();
  const openSearch = useUiStore((state) => state.openSearch);
  const openCart = useUiStore((state) => state.openCart);
  const { pathname } = useLocation();

  const itemCount = cart?.itemCount ?? 0;

  // The cart page and checkout have their own primary actions.
  const showCartBar = itemCount > 0 && !['/cart', '/checkout'].includes(pathname);

  return (
    <>
      {showCartBar && (
        <motion.div
          initial={{ y: 70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-[4.25rem] z-30 px-4 lg:hidden"
        >
          <button
            type="button"
            onClick={openCart}
            className="flex w-full items-center justify-between gap-3 rounded-full bg-espresso px-5 py-3.5 text-cream shadow-lifted"
          >
            <span className="flex items-center gap-2.5">
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-cream/15 px-1.5 font-sans text-xs font-semibold tabular-nums">
                {itemCount}
              </span>
              <span className="font-sans text-sm font-medium">
                {itemCount === 1 ? 'item' : 'items'} in your order
              </span>
            </span>
            <span className="font-sans text-sm font-semibold tabular-nums">
              {formatINR(cart?.totals.subtotal ?? 0)}
            </span>
          </button>
        </motion.div>
      )}

      <nav
        aria-label="Mobile navigation"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-cream/95 backdrop-blur-md lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {TABS.map((tab) => {
            const Icon = tab.icon;

            if (tab.isSearch) {
              return (
                <li key={tab.label}>
                  <button
                    type="button"
                    onClick={openSearch}
                    className="flex w-full flex-col items-center gap-1 py-2.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                    <span className="font-sans text-[0.625rem] font-medium">{tab.label}</span>
                  </button>
                </li>
              );
            }

            return (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.to === '/' || tab.to === '/account'}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1 py-2.5 transition-colors',
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={isActive ? 2.25 : 1.75} />
                      <span className="font-sans text-[0.625rem] font-medium">{tab.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Keeps page content clear of the fixed bars. */}
      <div aria-hidden className={cn('lg:hidden', showCartBar ? 'h-[7.5rem]' : 'h-16')} />
      <Link to="/cart" className="sr-only">
        View your cart
      </Link>
    </>
  );
}
