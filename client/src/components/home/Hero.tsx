import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=2000&q=85';

/**
 * The hero. One large photograph, a slow parallax drift on scroll, and copy that
 * states what the café is rather than shouting an offer.
 */
export function Hero() {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();

  // A restrained parallax: the image drifts 12% of the scrolled distance.
  const imageY = useTransform(scrollY, [0, 700], ['0%', '12%']);
  const contentOpacity = useTransform(scrollY, [0, 420], [1, 0]);

  return (
    <section className="relative -mt-20 flex min-h-[92svh] items-end overflow-hidden lg:-mt-[5.5rem] lg:min-h-[100svh]">
      <motion.div
        aria-hidden
        style={reduceMotion ? undefined : { y: imageY }}
        className="absolute inset-0 -bottom-[12%]"
      >
        <img
          src={HERO_IMAGE}
          alt=""
          className="h-full w-full object-cover object-center"
          decoding="async"
          width={2000}
          height={1333}
          // Lowercase attribute: React 18 doesn't map the camelCase form.
          {...{ fetchpriority: 'high' }}
        />
      </motion.div>

      {/* Two scrims: a vertical one to seat the header and ground the copy, and
          a horizontal one so the headline always lands on a dark field while the
          right-hand side of the photograph stays visible. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-charcoal/[0.92] via-charcoal/45 to-charcoal/55" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-charcoal/80 via-charcoal/30 to-transparent" />

      <motion.div
        style={reduceMotion ? undefined : { opacity: contentOpacity }}
        className="container relative z-10 pb-16 pt-32 lg:pb-24"
      >
        <div className="max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-eyebrow font-sans font-medium uppercase text-cream/65"
          >
            Bengaluru · Mumbai · Hyderabad
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 text-display-lg text-cream text-balance"
          >
            Slow mornings,
            <br />
            <span className="italic" style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1, 'opsz' 90" }}>
              carefully made.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl font-sans text-[1.0625rem] leading-relaxed text-cream/80 text-pretty"
          >
            An <em className="font-display not-italic">alaap</em> is the unhurried opening of a raga — the part before
            the rhythm arrives. We named the café after it, then built everything else to match.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg" variant="accent">
              <Link to="/menu">
                Order Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-cream/30 bg-cream/[0.06] text-cream backdrop-blur-sm hover:border-cream/60 hover:bg-cream/[0.12]"
            >
              <Link to="/menu">Explore Menu</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-sans text-xs text-cream/60"
          >
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              Five rooms, five cities
            </span>
            <span className="hidden h-3 w-px bg-cream/20 sm:block" />
            <span>Roasted in-house, weekly</span>
            <span className="hidden h-3 w-px bg-cream/20 sm:block" />
            <span>Delivery · Pickup · Dine-in</span>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
