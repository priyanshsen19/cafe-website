import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductGridSkeleton } from '@/components/ui/skeleton';
import { ProductCard } from '@/components/menu/ProductCard';
import { Reveal, SectionHeading } from '@/components/common/Reveal';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

/** A titled row of dish cards, used for each homepage collection. */
export function CollectionSection({
  eyebrow,
  title,
  description,
  products,
  to,
  isLoading,
  columns = 4,
  className,
  onOpenProduct,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  products: Product[];
  to: string;
  isLoading?: boolean;
  columns?: 3 | 4 | 5;
  className?: string;
  onOpenProduct: (slug: string) => void;
}) {
  if (!isLoading && products.length === 0) return null;

  return (
    <section className={cn('container py-16 lg:py-24', className)}>
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to={to}>
              See all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
        className="mb-10"
      />

      {isLoading ? (
        <ProductGridSkeleton count={columns} />
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 gap-5 sm:grid-cols-2',
            columns === 3 && 'lg:grid-cols-3',
            columns === 4 && 'lg:grid-cols-3 xl:grid-cols-4',
            columns === 5 && 'lg:grid-cols-4 xl:grid-cols-5',
          )}
        >
          {products.slice(0, columns === 5 ? 5 : columns === 3 ? 3 : 4).map((product, index) => (
            <Reveal key={product.id} delay={index * 0.06}>
              <ProductCard product={product} onOpen={onOpenProduct} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

const STORY_IMAGES = {
  roasting: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=1200&h=1500&q=85',
  barista: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&h=900&q=85',
  interior: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1200&h=900&q=85',
};

/**
 * The editorial "our story" block: a stacked image column against a column of
 * text set in the display serif. This is the section that has to feel like a
 * magazine spread rather than a landing page.
 */
export function StorySection() {
  return (
    <section className="bg-paper py-20 lg:py-32">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* ── imagery ── */}
          <Reveal className="order-2 lg:order-1">
            <div className="grid grid-cols-5 grid-rows-6 gap-4">
              <div className="media col-span-3 row-span-6 rounded-lg">
                <img src={STORY_IMAGES.roasting} alt="Green coffee going into the roaster" width={800} height={1000} loading="lazy" />
              </div>
              <div className="media col-span-2 row-span-3 rounded-lg">
                <img src={STORY_IMAGES.barista} alt="A barista finishing a pour" width={600} height={450} loading="lazy" />
              </div>
              <div className="media col-span-2 row-span-3 rounded-lg">
                <img src={STORY_IMAGES.interior} alt="The room at ALAAP Indiranagar" width={600} height={450} loading="lazy" />
              </div>
            </div>
          </Reveal>

          {/* ── text ── */}
          <div className="order-1 lg:order-2">
            <Reveal>
              <p className="eyebrow">Our story</p>
              <h2 className="mt-4 text-display-md text-foreground text-balance">
                Coffee is our craft.
                <br />
                Food is our language.
              </h2>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="mt-8 space-y-5 font-sans text-[0.9375rem] leading-[1.75] text-muted-foreground">
                <p>
                  We started in 2019 with one lever machine, a fridge, and a very small kitchen in Indiranagar. The plan
                  was modest: pull good espresso, bake something worth eating, and let people sit as long as they liked.
                </p>
                <p>
                  Our green coffee comes from four estates we visit each harvest — Attikan and Kalledevarapura in
                  Chikmagalur, a smallholder lot near Chikmagalur town, and one washed Ethiopian we buy through a friend.
                  We roast twice a week and never serve a bean older than eleven days.
                </p>
                <p>
                  The kitchen works the same way. Bread is baked each morning, pasta is rolled each morning, and the
                  menu shrinks when something runs out rather than pretending otherwise.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.18}>
              <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-8">
                {[
                  { value: 'Four', label: 'Estates we buy from' },
                  { value: '11 days', label: 'Maximum roast age' },
                  { value: 'Daily', label: 'Bread &amp; pasta' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="font-display text-2xl text-foreground">{stat.value}</dt>
                    <dd
                      className="mt-1 font-sans text-xs leading-snug text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: stat.label }}
                    />
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={0.24}>
              <Button asChild variant="outline" className="mt-9">
                <Link to="/about">
                  Read more about us
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Three-up explanation of how ordering works — delivery, pickup, dine-in. */
export function OrderModesSection() {
  const modes = [
    {
      title: 'Delivery',
      copy: 'Enjoy it wherever you are. Free over ₹499, and it arrives in 25–35 minutes.',
      image: 'https://images.unsplash.com/photo-1503481766315-7a586b20f66d?auto=format&fit=crop&w=900&h=1100&q=85',
    },
    {
      title: 'Pickup',
      copy: 'Skip the queue. Order ahead, walk in, and it’s waiting on the counter with your name on it.',
      image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&h=1100&q=85',
    },
    {
      title: 'Dine-in',
      copy: 'You’re already here. Scan the code on your table and we’ll bring everything over.',
      image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&h=1100&q=85',
    },
  ];

  return (
    <section className="container py-16 lg:py-24">
      <SectionHeading
        eyebrow="Three ways"
        title="However you’d like it"
        description="The same menu, the same kitchen. Choose how it reaches you at checkout."
        align="center"
        className="mb-12"
      />

      <div className="grid gap-5 md:grid-cols-3">
        {modes.map((mode, index) => (
          <Reveal key={mode.title} delay={index * 0.08}>
            <Link
              to="/menu"
              className="group relative block overflow-hidden rounded-lg"
              aria-label={`${mode.title} — order now`}
            >
              <div className="media aspect-[4/5]">
                <img src={mode.image} alt="" width={900} height={1100} loading="lazy" />
              </div>
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-charcoal/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <h3 className="font-display text-2xl text-cream">{mode.title}</h3>
                <p className="mt-2 font-sans text-[0.8125rem] leading-relaxed text-cream/75">{mode.copy}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 font-sans text-xs font-medium text-cream">
                  Start an order
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-editorial group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** Closing invitation before the footer. */
export function VisitSection() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=2000&q=85"
          alt=""
          className="h-full w-full object-cover"
          width={2000}
          height={1200}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-charcoal/[0.72]" />
      </div>

      <div className="container relative py-24 text-center lg:py-32">
        <Reveal>
          <p className="text-eyebrow font-sans font-medium uppercase text-cream/60">Come sit with us</p>
          <h2 className="mx-auto mt-5 max-w-2xl text-display-md text-cream text-balance">
            There’s a table by the window with your name on it.
          </h2>
          <p className="mx-auto mt-5 max-w-lg font-sans text-[0.9375rem] leading-relaxed text-cream/75">
            Five rooms across Bengaluru, Mumbai and Hyderabad. Open from eight in the morning, every day of the week.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="accent">
              <Link to="/locations">Find a café</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-cream/30 bg-cream/[0.06] text-cream hover:border-cream/60 hover:bg-cream/[0.12]"
            >
              <Link to="/menu">Order Now</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
