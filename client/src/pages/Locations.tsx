import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/form-controls';
import { ErrorState } from '@/components/common/States';
import { Reveal } from '@/components/common/Reveal';
import { publicApi } from '@/api/endpoints';
import { useSeo } from '@/hooks/useUtils';
import { formatTime } from '@/lib/utils';

export default function Locations() {
  useSeo({
    title: 'Locations',
    description:
      'Five ALAAP cafés across Bengaluru, Mumbai and Hyderabad. Addresses, opening hours and phone numbers.',
    canonicalPath: '/locations',
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cafes'],
    queryFn: () => publicApi.cafes().then((response) => response.cafes),
  });

  const cafes = data ?? [];
  const today = new Date().getDay();

  return (
    <>
      <div className="border-b border-border bg-paper">
        <div className="container py-12 lg:py-16">
          <Reveal>
            <p className="eyebrow">Locations</p>
            <h1 className="mt-4 text-display-md text-foreground text-balance">Five rooms, five neighbourhoods</h1>
            <p className="mt-4 max-w-2xl font-sans text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
              Each café is a little different — Koramangala has the roastery window, Jubilee Hills has the courtyard,
              Powai stays open latest. The coffee is the same everywhere.
            </p>
          </Reveal>
        </div>
      </div>

      <div className="container py-12 lg:py-16">
        {isError && (
          <ErrorState
            title="Unable to load our locations"
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => void refetch()}
          />
        )}

        {isLoading && (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-lg" />
            ))}
          </div>
        )}

        <div className="space-y-8">
          {cafes.map((cafe, index) => (
            <Reveal as="article" key={cafe.id} delay={index * 0.05}>
              <div className="grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[1.1fr_1fr]">
                {/* ── image, doubling as the map placeholder ── */}
                <div className="media relative aspect-[16/10] lg:aspect-auto lg:min-h-[19rem]">
                  {cafe.imageUrl && (
                    <img src={cafe.imageUrl} alt={`ALAAP ${cafe.name}`} width={1400} height={900} loading="lazy" />
                  )}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 backdrop-blur">
                    <MapPin className="h-3.5 w-3.5 text-terracotta" aria-hidden />
                    <span className="font-sans text-xs text-foreground">
                      {cafe.latitude?.toFixed(4)}, {cafe.longitude?.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* ── detail ── */}
                <div className="flex flex-col p-6 lg:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl text-foreground">{cafe.name}</h2>
                      <p className="mt-1 font-sans text-sm text-muted-foreground">
                        {cafe.city}, {cafe.state}
                      </p>
                    </div>
                    <Badge variant={cafe.openState.isOpen ? 'olive' : 'subtle'} size="lg">
                      {cafe.openState.isOpen ? 'Open now' : 'Closed'}
                    </Badge>
                  </div>

                  {cafe.tagline && (
                    <p className="mt-4 font-display text-[1.0625rem] italic leading-relaxed text-muted-foreground">
                      {cafe.tagline}
                    </p>
                  )}

                  <Separator className="my-5" />

                  <dl className="space-y-3.5 font-sans text-sm">
                    <div className="flex gap-3">
                      <dt className="sr-only">Address</dt>
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <dd className="text-foreground">
                        {cafe.line1}
                        <br />
                        {cafe.city} {cafe.postalCode}
                      </dd>
                    </div>

                    <div className="flex gap-3">
                      <dt className="sr-only">Phone</dt>
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <dd>
                        <a
                          href={`tel:${cafe.phone.replace(/\s/g, '')}`}
                          className="text-foreground transition-colors hover:text-accent"
                        >
                          {cafe.phone}
                        </a>
                      </dd>
                    </div>

                    <div className="flex gap-3">
                      <dt className="sr-only">Opening hours</dt>
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <dd className="text-foreground">
                        <ul className="space-y-0.5">
                          {cafe.hours.map((hour) => (
                            <li
                              key={hour.dayOfWeek}
                              className={hour.dayOfWeek === today ? 'font-medium text-foreground' : 'text-muted-foreground'}
                            >
                              <span className="inline-block w-24">{hour.day}</span>
                              {hour.label}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  </dl>

                  {!cafe.openState.isOpen && cafe.openState.nextOpensAt && (
                    <p className="mt-4 font-sans text-xs text-muted-foreground">
                      Reopens at {formatTime(cafe.openState.nextOpensAt)}.
                    </p>
                  )}

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <Button asChild>
                      <Link to="/menu">Order from here</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${cafe.line1}, ${cafe.city}`,
                        )}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Get directions
                      </a>
                    </Button>
                  </div>

                  <p className="mt-5 font-sans text-xs text-muted-foreground">
                    {cafe.tableCount} tables · QR ordering at every table
                    {cafe.supportsDelivery && ' · Delivery available'}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-12 text-center font-sans text-xs text-muted-foreground">
          ALAAP is a fictional brand created for a portfolio project. The addresses above are illustrative.
        </p>
      </div>
    </>
  );
}
