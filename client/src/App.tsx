import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { SiteLayout } from '@/layouts/SiteLayout';
import { useAuth } from '@/contexts/AuthContext';

// Route-level code splitting: the customer never downloads the admin bundle.
const Home = lazy(() => import('@/pages/Home'));
const Menu = lazy(() => import('@/pages/Menu'));
const MenuSlug = lazy(() => import('@/pages/MenuSlug'));
const SearchResults = lazy(() => import('@/pages/SearchResults'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const OrderSuccess = lazy(() => import('@/pages/OrderSuccess'));
const OrderTracking = lazy(() => import('@/pages/OrderTracking'));
const Locations = lazy(() => import('@/pages/Locations'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const AccountLayout = lazy(() => import('@/layouts/AccountLayout'));
const AccountOverview = lazy(() => import('@/pages/account/Overview'));
const AccountOrders = lazy(() => import('@/pages/account/Orders'));
const AccountAddresses = lazy(() => import('@/pages/account/Addresses'));
const AccountWishlist = lazy(() => import('@/pages/account/Wishlist'));
const AccountProfile = lazy(() => import('@/pages/account/Profile'));
const AccountSecurity = lazy(() => import('@/pages/account/Security'));

const Kitchen = lazy(() => import('@/pages/Kitchen'));
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminMenu = lazy(() => import('@/pages/admin/MenuManager'));
const AdminOrders = lazy(() => import('@/pages/admin/Orders'));
const AdminCustomers = lazy(() => import('@/pages/admin/Customers'));
const AdminTables = lazy(() => import('@/pages/admin/Tables'));
const AdminCoupons = lazy(() => import('@/pages/admin/Coupons'));

function PageLoader() {
  return (
    <div className="grid min-h-[60svh] place-items-center" role="status" aria-label="Loading">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Auth gate. While the initial session refresh is in flight we show a loader
 * rather than bouncing the visitor to /login, which would otherwise flash on
 * every hard refresh of a protected page.
 */
function RequireAuth({ children, role }: { children: React.ReactNode; role?: 'STAFF' | 'ADMIN' }) {
  const { isAuthenticated, isLoading, isStaff, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader />;

  if (!isAuthenticated) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  if (role === 'ADMIN' && !isAdmin) return <Navigate to="/" replace />;
  if (role === 'STAFF' && !isStaff) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── kitchen & admin get their own chrome ── */}
        <Route
          path="/kitchen"
          element={
            <RequireAuth role="STAFF">
              <Kitchen />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth role="ADMIN">
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="tables" element={<AdminTables />} />
          <Route path="coupons" element={<AdminCoupons />} />
        </Route>

        {/* ── storefront ── */}
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          {/* One segment serves both a category view and a dish page — the
              resolver decides, which keeps /menu/coffee and
              /menu/truffle-mushroom-pasta both valid, readable URLs. */}
          <Route path="/menu/:slug" element={<MenuSlug />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/checkout"
            element={
              <RequireAuth>
                <Checkout />
              </RequireAuth>
            }
          />
          <Route
            path="/orders/:id/success"
            element={
              <RequireAuth>
                <OrderSuccess />
              </RequireAuth>
            }
          />
          <Route
            path="/orders/:id/tracking"
            element={
              <RequireAuth>
                <OrderTracking />
              </RequireAuth>
            }
          />

          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AccountOverview />} />
            <Route path="orders" element={<AccountOrders />} />
            <Route path="addresses" element={<AccountAddresses />} />
            <Route path="wishlist" element={<AccountWishlist />} />
            <Route path="profile" element={<AccountProfile />} />
            <Route path="security" element={<AccountSecurity />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
