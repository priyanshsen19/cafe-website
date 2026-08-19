import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi } from '@/api/endpoints';
import { setAccessToken, setUnauthorizedHandler } from '@/api/client';
import type { AccountStats, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  stats: AccountStats | null;
  /** True until the initial refresh attempt settles, so guards don't flash. */
  isLoading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The session restore is deduped at module scope.
 *
 * Refresh tokens rotate — presenting one consumes it — so two concurrent
 * restores would race: the first succeeds, the second finds the token already
 * spent and fails, leaving the app as a guest. React's StrictMode mounts
 * effects twice in development, which triggers exactly that. Sharing one
 * in-flight promise means the token is presented once, no matter how many
 * callers ask.
 */
let restorePromise: ReturnType<typeof authApi.refresh> | null = null;

function restoreSession() {
  restorePromise ??= authApi.refresh().finally(() => {
    // Clear on the next tick so a later sign-out/sign-in can restore again.
    setTimeout(() => {
      restorePromise = null;
    }, 0);
  });
  return restorePromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStats(null);
    queryClient.clear();
  }, [queryClient]);

  // Restore the session on boot using the httpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { accessToken, user: refreshed } = await restoreSession();
        if (cancelled) return;
        setAccessToken(accessToken);
        setUser(refreshed);

        // Queries mounted during the restore ran as a guest — the cart in
        // particular would have come back empty. Refetch them now that the
        // session exists, otherwise a reload shows a signed-in customer an
        // empty cart until they navigate.
        await queryClient.invalidateQueries();

        const me = await authApi.me();
        if (!cancelled) setStats(me.stats);
      } catch {
        // No valid session — the visitor browses as a guest.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  // A failed refresh mid-session means the session is genuinely over.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser((current) => {
        if (current) toast.error('Your session has expired. Please sign in again.');
        return null;
      });
      setStats(null);
      queryClient.clear();
    });

    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login({ email, password });
      setAccessToken(result.accessToken);
      setUser(result.user);

      // The guest cart was merged server-side; drop cached guest state.
      await queryClient.invalidateQueries();

      const me = await authApi.me().catch(() => null);
      if (me) setStats(me.stats);

      return result.user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: { name: string; email: string; phone: string; password: string; confirmPassword: string }) => {
      const result = await authApi.register(input);
      setAccessToken(result.accessToken);
      setUser(result.user);
      await queryClient.invalidateQueries();
      return result.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const me = await authApi.me().catch(() => null);
    if (me) {
      setUser(me.user);
      setStats(me.stats);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      stats,
      isLoading,
      isAuthenticated: Boolean(user),
      isStaff: user?.role === 'STAFF' || user?.role === 'ADMIN',
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, stats, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
