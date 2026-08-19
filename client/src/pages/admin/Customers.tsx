import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { adminApi } from '@/api/endpoints';
import { useDebounced, useSeo } from '@/hooks/useUtils';
import { formatDate, formatINR, initials } from '@/lib/utils';

export default function AdminCustomers() {
  useSeo({ title: 'Customers — Admin' });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim(), 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'customers', debouncedSearch],
    queryFn: () => adminApi.customers(debouncedSearch || undefined).then((response) => response.customers),
  });

  const customers = data ?? [];

  return (
    <div>
      <h1 className="font-display text-2xl text-foreground">Customers</h1>
      <p className="mt-1.5 font-sans text-sm text-muted-foreground">
        {data ? `${data.length} registered customers` : 'Loading…'}
      </p>

      <div className="mt-6 max-w-md">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or phone…"
            aria-label="Search customers"
            className="h-10 pl-9"
          />
        </div>
      </div>

      {isError && (
        <ErrorState
          title="Unable to load customers"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="mt-6 space-y-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !isError && customers.length === 0 && (
        <EmptyState
          icon={Users}
          title="No customers match"
          description="Try a different search term."
          className="mt-6 rounded-lg border border-border bg-card"
        />
      )}

      {customers.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
          <div className="scroll-x">
            <table className="w-full min-w-[46rem] border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th scope="col" className="px-5 py-3 text-left font-sans text-xs font-medium text-muted-foreground">
                    Customer
                  </th>
                  <th scope="col" className="px-5 py-3 text-left font-sans text-xs font-medium text-muted-foreground">
                    Contact
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-sans text-xs font-medium text-muted-foreground">
                    Orders
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-sans text-xs font-medium text-muted-foreground">
                    Total spent
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-sans text-xs font-medium text-muted-foreground">
                    Last order
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-sans text-xs font-medium text-muted-foreground">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((customer) => (
                  <tr key={customer.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary font-sans text-[0.6875rem] font-semibold uppercase text-foreground">
                          {initials(customer.name)}
                        </span>
                        <span className="font-sans text-sm font-medium text-foreground">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-sans text-[0.8125rem] text-foreground">{customer.email}</p>
                      <p className="font-sans text-xs text-muted-foreground">{customer.phone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans text-sm tabular-nums text-foreground">
                      {customer.orderCount}
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans text-sm tabular-nums text-foreground">
                      {formatINR(customer.totalSpent)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans text-xs text-muted-foreground">
                      {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans text-xs text-muted-foreground">
                      {formatDate(customer.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3 rounded-lg border border-border bg-card p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-olive" aria-hidden />
        <p className="font-sans text-xs leading-relaxed text-muted-foreground">
          This view never selects password hashes, tokens or any other authentication material — the API excludes them
          at the query level, so they cannot appear here even by accident.
        </p>
      </div>
    </div>
  );
}
