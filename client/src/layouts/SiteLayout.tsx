import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileNav } from '@/components/layout/MobileNav';
import { SearchDialog } from '@/components/layout/SearchDialog';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { ClosedBanner, DineInBanner } from '@/components/layout/Banners';

/** Every navigation starts at the top of the new page, as a document would. */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}

export function SiteLayout() {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />

      {/* Keyboard users get a way past the navigation. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-espresso focus:px-4 focus:py-2.5 focus:font-sans focus:text-sm focus:text-cream"
      >
        Skip to content
      </a>

      <DineInBanner />
      <ClosedBanner />
      <Header />

      <main id="main" className="flex-1">
        {reduceMotion ? (
          <Outlet />
        ) : (
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        )}
      </main>

      <Footer />
      <MobileNav />

      <CartDrawer />
      <SearchDialog />
    </div>
  );
}
