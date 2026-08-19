import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { publicApi } from '@/api/endpoints';
import type { TableSession } from '@/types';

const STORAGE_KEY = 'alaap.table';

interface DineInContextValue {
  session: TableSession | null;
  isResolving: boolean;
  /** Set when a scanned token could not be resolved, so the UI can explain. */
  error: string | null;
  clear: () => void;
}

const DineInContext = createContext<DineInContextValue | null>(null);

/**
 * Turns `/menu?table=<qrToken>` into a dine-in session and keeps it for the rest
 * of the visit, so a guest who scans the QR at their table doesn't lose the
 * table when they navigate to the cart or checkout.
 */
export function DineInProvider({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<TableSession | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenFromUrl = searchParams.get('table');

  const clear = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setError(null);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const token = tokenFromUrl ?? stored;
    if (!token) return;

    let cancelled = false;
    setIsResolving(true);

    publicApi
      .table(token)
      .then((resolved) => {
        if (cancelled) return;
        setSession(resolved);
        setError(null);
        sessionStorage.setItem(STORAGE_KEY, token);

        // Tidy the URL once the table is bound to the session.
        if (tokenFromUrl) {
          const next = new URLSearchParams(searchParams);
          next.delete('table');
          setSearchParams(next, { replace: true });
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        sessionStorage.removeItem(STORAGE_KEY);
        setSession(null);
        setError(cause instanceof Error ? cause.message : 'That table code isn’t valid.');
      })
      .finally(() => {
        if (!cancelled) setIsResolving(false);
      });

    return () => {
      cancelled = true;
    };
    // Only re-run when the scanned token changes.

  }, [tokenFromUrl]);

  const value = useMemo(() => ({ session, isResolving, error, clear }), [session, isResolving, error, clear]);

  return <DineInContext.Provider value={value}>{children}</DineInContext.Provider>;
}

export function useDineIn() {
  const context = useContext(DineInContext);
  if (!context) throw new Error('useDineIn must be used inside DineInProvider');
  return context;
}
