import { Link } from 'react-router-dom';
import { Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from '@/components/common/Logo';

const MENU_LINKS = [
  { label: 'Coffee', to: '/menu/coffee' },
  { label: 'Cold Coffee', to: '/menu/cold-coffee' },
  { label: 'Matcha & Tea', to: '/menu/matcha-tea' },
  { label: 'Breakfast', to: '/menu/breakfast' },
  { label: 'Bakery', to: '/menu/bakery' },
  { label: 'Signature Specials', to: '/menu/signature' },
];

const CAFE_LINKS = [
  { label: 'Our story', to: '/about' },
  { label: 'Locations', to: '/locations' },
  { label: 'Contact', to: '/contact' },
  { label: 'My orders', to: '/account/orders' },
];

export function Footer() {
  return (
    <footer className="mt-24 bg-charcoal text-cream">
      <div className="container py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* ── brand ── */}
          <div>
            <Logo tone="light" showTagline />
            <p className="mt-5 max-w-xs font-display text-lg leading-relaxed text-cream/75">
              Coffee is our craft. Food is our language. The café is where they meet.
            </p>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-6 inline-flex items-center gap-2 font-sans text-sm text-cream/60 transition-colors hover:text-cream"
            >
              <Instagram className="h-4 w-4" aria-hidden />
              @alaap.coffee
            </a>
          </div>

          {/* ── menu ── */}
          <nav aria-label="Menu">
            <h3 className="font-sans text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-cream/45">Menu</h3>
            <ul className="mt-5 space-y-3">
              {MENU_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="link-underline font-sans text-sm text-cream/75 transition-colors hover:text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── café ── */}
          <nav aria-label="Café">
            <h3 className="font-sans text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-cream/45">Café</h3>
            <ul className="mt-5 space-y-3">
              {CAFE_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="link-underline font-sans text-sm text-cream/75 transition-colors hover:text-cream"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── visit ── */}
          <div>
            <h3 className="font-sans text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-cream/45">Visit</h3>
            <ul className="mt-5 space-y-4 font-sans text-sm text-cream/75">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cream/40" aria-hidden />
                <span>
                  12/3, 100 Feet Road
                  <br />
                  Indiranagar, Bengaluru 560038
                </span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-cream/40" aria-hidden />
                <a href="tel:+918047182200" className="transition-colors hover:text-cream">
                  +91 80 4718 2200
                </a>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-cream/40" aria-hidden />
                <a href="mailto:hello@alaap.coffee" className="transition-colors hover:text-cream">
                  hello@alaap.coffee
                </a>
              </li>
            </ul>

            <div className="mt-6 border-t border-cream/[0.12] pt-5 font-sans text-sm text-cream/60">
              <p className="text-cream/75">Open every day</p>
              <p className="mt-1.5">Mon–Fri &nbsp;8:00 AM – 11:00 PM</p>
              <p>Sat–Sun &nbsp;8:00 AM – 12:00 AM</p>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-cream/[0.12] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-sans text-xs text-cream/45">
            © {new Date().getFullYear()} ALAAP Coffee Roasters &amp; Kitchen. A demonstration project.
          </p>
          <p className="font-sans text-xs text-cream/45">
            Delivery · Pickup · Dine-in · QR table ordering
          </p>
        </div>
      </div>
    </footer>
  );
}
