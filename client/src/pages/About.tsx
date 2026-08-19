import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/common/Reveal';
import { useSeo } from '@/hooks/useUtils';

const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=2000&q=85',
  beans: 'https://images.unsplash.com/photo-1524350876685-274059332603?auto=format&fit=crop&w=1200&h=900&q=85',
  roasting: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=1200&h=1500&q=85',
  kitchen: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1200&h=900&q=85',
  bread: 'https://images.unsplash.com/photo-1481931098730-318b6f776db0?auto=format&fit=crop&w=1200&h=900&q=85',
  team: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&h=900&q=85',
  interior: 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=1600&h=900&q=85',
};

/** Editorial chapter: a heading, body copy, and one photograph. */
function Chapter({
  eyebrow,
  title,
  image,
  imageAlt,
  reverse,
  children,
}: {
  eyebrow: string;
  title: string;
  image: string;
  imageAlt: string;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="container py-14 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className={reverse ? 'lg:order-2' : undefined}>
          <div className="media aspect-[4/3] rounded-lg">
            <img src={image} alt={imageAlt} width={1200} height={900} loading="lazy" />
          </div>
        </Reveal>

        <div className={reverse ? 'lg:order-1' : undefined}>
          <Reveal>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="mt-4 text-display-sm text-foreground text-balance">{title}</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-6 space-y-4 font-sans text-[0.9375rem] leading-[1.75] text-muted-foreground">
              {children}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default function About() {
  useSeo({
    title: 'Our story',
    description:
      'How ALAAP started, where our coffee comes from, how we roast it, and what happens in the kitchen each morning.',
    canonicalPath: '/about',
  });

  return (
    <>
      {/* ── opening spread ── */}
      <section className="relative -mt-20 flex min-h-[75svh] items-end overflow-hidden lg:-mt-[5.5rem]">
        <div aria-hidden className="absolute inset-0">
          <img src={IMAGES.hero} alt="" className="h-full w-full object-cover" width={2000} height={1200} />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/40 to-charcoal/50" />
        </div>

        <div className="container relative z-10 pb-16 pt-32">
          <Reveal>
            <p className="text-eyebrow font-sans font-medium uppercase text-cream/60">Since 2019</p>
            <h1 className="mt-5 max-w-3xl text-display-lg text-cream text-balance">
              Coffee is our craft.
              <br />
              Food is our language.
              <br />
              <span className="italic" style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1, 'opsz' 90" }}>
                The café is where they meet.
              </span>
            </h1>
          </Reveal>
        </div>
      </section>

      {/* ── lede ── */}
      <section className="container py-16 lg:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="font-display text-2xl leading-[1.5] text-foreground text-pretty lg:text-[1.75rem]">
            We opened with twelve seats, one lever machine and a domestic oven. The idea was never to be the biggest
            café in Bengaluru — only to be the one where nothing was rushed.
          </p>
        </Reveal>
      </section>

      <Chapter
        eyebrow="Our story"
        title="It started with a bad cup of coffee"
        image={IMAGES.interior}
        imageAlt="The room at ALAAP Indiranagar"
      >
        <p>
          In 2018 two of us were working jobs we didn’t much like, drinking coffee we liked even less. We started
          roasting on a 500g sample roaster on a balcony in Indiranagar, mostly to prove to ourselves that it could taste
          better than what we were being sold.
        </p>
        <p>
          A year later we took over a narrow ground-floor space on 100 Feet Road, put in a counter long enough for
          twelve people, and opened without a sign on the door. Word got round anyway.
        </p>
        <p>
          There are five rooms now, across three cities. The counter at Indiranagar is still the same one.
        </p>
      </Chapter>

      <div className="bg-paper">
        <Chapter
          eyebrow="Sourcing"
          title="Four estates, visited every harvest"
          image={IMAGES.beans}
          imageAlt="Green coffee beans"
          reverse
        >
          <p>
            Most of our coffee comes from Chikmagalur — Attikan Estate for its structure, Kalledevarapura for the
            naturals that go into our cold brew, and a smallholder lot we buy from a family we’ve worked with since the
            second year.
          </p>
          <p>
            The fourth is a washed Ethiopian Guji we buy through a friend’s importing business, in small quantities,
            because it makes our espresso blend sing in a way nothing local quite does.
          </p>
          <p>
            We visit each of them during harvest. Not for a photograph — to taste what’s coming and agree a price
            before anyone else does.
          </p>
        </Chapter>
      </div>

      <Chapter
        eyebrow="Roasting"
        title="Twice a week, never more than eleven days old"
        image={IMAGES.roasting}
        imageAlt="Coffee in the roaster drum"
      >
        <p>
          We roast on a 12kg drum roaster behind the glass at Koramangala, twice a week, in the early morning before
          service. Espresso goes medium — enough development to hold up in milk, stopped well short of anything you’d
          call dark.
        </p>
        <p>
          Filter roasts go lighter and rest four days. Espresso rests seven. Nothing is served past day eleven; whatever
          is left goes home with the staff, which is a good incentive to roast the right amount.
        </p>
      </Chapter>

      <div className="bg-paper">
        <Chapter
          eyebrow="The kitchen"
          title="Bread at six, pasta at seven"
          image={IMAGES.kitchen}
          imageAlt="The kitchen during service"
          reverse
        >
          <p>
            Croissant dough is laminated at midnight and baked from six. Sourdough is a four-day process. Pasta is
            rolled and cut each morning — tagliatelle, fettuccine, and whatever short shape the sauce needs.
          </p>
          <p>
            The menu is deliberately short, and it gets shorter as the day goes on. When the almond croissants are
            finished at eleven, they’re finished. We’d rather tell you that than sell you yesterday’s.
          </p>
        </Chapter>
      </div>

      <Chapter
        eyebrow="Sustainability"
        title="The unglamorous parts"
        image={IMAGES.bread}
        imageAlt="Bread cooling on racks"
      >
        <p>
          Spent grounds go to two urban farms in Bengaluru and a composting collective in Bandra. Chaff from roasting
          goes the same way. Milk arrives in reusable steel cans at three of the five cafés, and we’re working on the
          other two.
        </p>
        <p>
          We charge for takeaway cups and take ₹20 off if you bring your own. It isn’t a solution, but it changed
          behaviour more than a poster ever did.
        </p>
        <p>
          Bakery that hasn’t sold by close is boxed and given away rather than binned. On a good day that’s nothing. On
          a slow Tuesday it’s a lot.
        </p>
      </Chapter>

      {/* ── team ── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0">
          <img src={IMAGES.team} alt="" className="h-full w-full object-cover" width={1600} height={900} loading="lazy" />
          <div className="absolute inset-0 bg-charcoal/[0.78]" />
        </div>

        <div className="container relative py-20 lg:py-28">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-eyebrow font-sans font-medium uppercase text-cream/60">The people</p>
            <h2 className="mt-5 text-display-md text-cream text-balance">Forty-one of us, and one shared shift rule</h2>
            <p className="mt-5 font-sans text-[0.9375rem] leading-relaxed text-cream/75 text-pretty">
              Nobody works a double. Everyone learns the bar, the kitchen and the floor in their first three months,
              because it’s hard to care about a drink you’ve never had to make.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="accent">
                <Link to="/menu">See what we’re making</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-cream/30 bg-cream/[0.06] text-cream hover:border-cream/60 hover:bg-cream/[0.12]"
              >
                <Link to="/contact">Get in touch</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
