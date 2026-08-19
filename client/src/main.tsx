import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/misc';
import { AuthProvider } from '@/contexts/AuthContext';
import { DineInProvider } from '@/contexts/DineInContext';
import { ApiError } from '@/api/client';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry the customer's own mistakes (401/403/404/422) — only
        // transient server or network faults.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <DineInProvider>
            <TooltipProvider delayDuration={350}>
              <App />
              <Toaster
                position="bottom-right"
                closeButton
                toastOptions={{
                  className: 'font-sans',
                  style: {
                    background: 'hsl(40 50% 98%)',
                    color: 'hsl(18 23% 13%)',
                    border: '1px solid hsl(36 30% 86%)',
                    borderRadius: '0.625rem',
                  },
                }}
              />
            </TooltipProvider>
          </DineInProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
