import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Plus, QrCode, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { Logo } from '@/components/common/Logo';
import { adminApi, publicApi } from '@/api/endpoints';
import { useSeo } from '@/hooks/useUtils';
import { cn } from '@/lib/utils';
import type { TableStatus } from '@/types';

const STATUS_VARIANT: Record<TableStatus, 'olive' | 'accent' | 'muted' | 'subtle'> = {
  AVAILABLE: 'olive',
  OCCUPIED: 'accent',
  RESERVED: 'muted',
  CLEANING: 'subtle',
};

const STATUSES: TableStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];

export default function AdminTables() {
  useSeo({ title: 'Tables & QR — Admin' });

  const queryClient = useQueryClient();
  const [cafeFilter, setCafeFilter] = useState<string>('ALL');
  const [qrTableId, setQrTableId] = useState<string | null>(null);
  const [isAdding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: cafes } = useQuery({
    queryKey: ['cafes'],
    queryFn: () => publicApi.cafes().then((response) => response.cafes),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'tables', cafeFilter],
    queryFn: () => adminApi.tables(cafeFilter === 'ALL' ? undefined : cafeFilter).then((response) => response.tables),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatus }) => adminApi.updateTable(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] });
      toast.success('Table updated');
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteTable(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] });
      toast.success(result.deactivated ? 'Table has past orders, so it was deactivated' : 'Table removed');
      setConfirmDelete(null);
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const tables = data ?? [];
  const grouped = tables.reduce<Record<string, typeof tables>>((accumulator, table) => {
    const key = table.cafe.name;
    (accumulator[key] ??= []).push(table);
    return accumulator;
  }, {});

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-foreground">Tables &amp; QR codes</h1>
          <p className="mt-1.5 font-sans text-sm text-muted-foreground">
            {tables.length} tables · each QR opens the menu with the table already attached
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Wand2 className="h-4 w-4" />
            Generate run
          </Button>
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add table
          </Button>
        </div>
      </div>

      <div className="mt-6 max-w-xs">
        <Select value={cafeFilter} onValueChange={setCafeFilter}>
          <SelectTrigger className="h-10" aria-label="Filter by location">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All locations</SelectItem>
            {(cafes ?? []).map((cafe) => (
              <SelectItem key={cafe.id} value={cafe.id}>
                {cafe.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <ErrorState
          title="Unable to load tables"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="mt-6 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !isError && tables.length === 0 && (
        <EmptyState
          icon={QrCode}
          title="No tables yet"
          description="Add tables so guests can scan and order from their seat."
          action={{ label: 'Add a table', onClick: () => setAdding(true) }}
          className="mt-6 rounded-lg border border-border bg-card"
        />
      )}

      {Object.entries(grouped).map(([cafeName, cafeTables]) => (
        <section key={cafeName} className="mt-8">
          <h2 className="font-display text-lg text-foreground">{cafeName}</h2>
          <p className="mt-1 font-sans text-xs text-muted-foreground">{cafeTables.length} tables</p>

          <ul className="mt-4 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {cafeTables.map((table) => (
              <li
                key={table.id}
                className={cn(
                  'rounded-lg border bg-card p-4',
                  table.isActive ? 'border-border' : 'border-dashed border-border opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-xl text-foreground">{table.label}</span>
                  <Badge variant={STATUS_VARIANT[table.status]} size="sm">
                    {table.status.toLowerCase()}
                  </Badge>
                </div>

                <p className="mt-1.5 font-sans text-xs text-muted-foreground">
                  {table.floor} · seats {table.capacity}
                </p>
                {table.activeOrderCount > 0 && (
                  <p className="mt-1 font-sans text-xs text-terracotta">
                    {table.activeOrderCount} live {table.activeOrderCount === 1 ? 'order' : 'orders'}
                  </p>
                )}

                <div className="mt-3.5 flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setQrTableId(table.id)}
                    aria-label={`Show QR for table ${table.label}`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    QR
                  </Button>

                  {confirmDelete === table.id ? (
                    <Button size="icon-sm" variant="destructive" loading={remove.isPending} onClick={() => remove.mutate(table.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDelete(table.id)}
                      aria-label={`Delete table ${table.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <Select
                  value={table.status}
                  onValueChange={(value) => updateStatus.mutate({ id: table.id, status: value as TableStatus })}
                >
                  <SelectTrigger className="mt-2 h-8 text-xs" aria-label={`Status for table ${table.label}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <QrDialog tableId={qrTableId} open={Boolean(qrTableId)} onOpenChange={(open) => !open && setQrTableId(null)} />
      <AddTableDialog open={isAdding} onOpenChange={setAdding} cafes={cafes ?? []} />
    </div>
  );
}

/** Printable QR card, with SVG for print and a PNG for download. */
function QrDialog({
  tableId,
  open,
  onOpenChange,
}: {
  tableId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'table-qr', tableId],
    queryFn: () => adminApi.tableQr(tableId!),
    enabled: Boolean(tableId) && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{data ? `Table ${data.table.label}` : 'Table QR code'}</DialogTitle>
          <DialogDescription>
            {data ? `${data.cafe.name}, ${data.cafe.city}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {isLoading && <Skeleton className="aspect-square w-full rounded-lg" />}

          {data && (
            <>
              {/* The printed card: brandmark, code, table number. */}
              <div className="rounded-lg border border-border bg-cream p-6 text-center">
                <Logo asLink={false} />
                <div
                  className="mx-auto mt-4 w-full max-w-[15rem] [&_svg]:h-auto [&_svg]:w-full"
                  // Server-generated QR markup for the table's opaque token.
                  dangerouslySetInnerHTML={{ __html: data.svg }}
                />
                <p className="mt-4 font-display text-2xl text-foreground">Table {data.table.label}</p>
                <p className="mt-1 font-sans text-xs text-muted-foreground">
                  Scan to see the menu and order from your seat
                </p>
              </div>

              <p className="mt-4 break-all rounded-md bg-secondary px-3 py-2 font-sans text-[0.6875rem] text-muted-foreground">
                {data.url}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button asChild>
                  <a href={data.pngDataUrl} download={`alaap-table-${data.table.label}.png`}>
                    <Download className="h-4 w-4" />
                    Download PNG
                  </a>
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  Print
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddTableDialog({
  open,
  onOpenChange,
  cafes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cafes: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [cafeId, setCafeId] = useState('');
  const [label, setLabel] = useState('');
  const [floor, setFloor] = useState('Ground');
  const [capacity, setCapacity] = useState('2');
  const [bulkCount, setBulkCount] = useState('');

  const createOne = useMutation({
    mutationFn: () =>
      adminApi.createTable({ cafeId, label: label.trim(), floor: floor.trim(), capacity: Number(capacity) || 2 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] });
      toast.success(`Table ${label} added`);
      setLabel('');
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createMany = useMutation({
    mutationFn: () => adminApi.generateTables({ cafeId, count: Number(bulkCount), floor: floor.trim() }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] });
      toast.success(`${result.tables.length} tables created with QR codes`);
      setBulkCount('');
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>Add tables</DialogTitle>
          <DialogDescription>Each table gets its own QR token automatically.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6">
          <div>
            <Label htmlFor="t-cafe">Location</Label>
            <Select value={cafeId} onValueChange={setCafeId}>
              <SelectTrigger id="t-cafe" className="mt-1.5">
                <SelectValue placeholder="Choose a location" />
              </SelectTrigger>
              <SelectContent>
                {cafes.map((cafe) => (
                  <SelectItem key={cafe.id} value={cafe.id}>
                    {cafe.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="t-floor">Floor</Label>
              <Input id="t-floor" value={floor} onChange={(event) => setFloor(event.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="t-capacity">Capacity</Label>
              <Input
                id="t-capacity"
                type="number"
                inputMode="numeric"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="font-sans text-[0.8125rem] font-medium text-foreground">Add a single table</p>
            <div className="mt-3 flex gap-2">
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value.toUpperCase())}
                placeholder="T21"
                aria-label="Table label"
                className="h-10"
              />
              <Button
                className="h-10"
                disabled={!cafeId || label.trim().length === 0}
                loading={createOne.isPending}
                onClick={() => createOne.mutate()}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="font-sans text-[0.8125rem] font-medium text-foreground">Generate a numbered run</p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">
              Fills the next available labels, e.g. T01 → T20.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                type="number"
                inputMode="numeric"
                value={bulkCount}
                onChange={(event) => setBulkCount(event.target.value)}
                placeholder="20"
                aria-label="How many tables"
                className="h-10"
              />
              <Button
                variant="outline"
                className="h-10"
                disabled={!cafeId || !bulkCount || Number(bulkCount) < 1}
                loading={createMany.isPending}
                onClick={() => createMany.mutate()}
              >
                <Wand2 className="h-4 w-4" />
                Generate
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
