import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * ALAAP's design tokens. Colours are declared as CSS variables in index.css and
 * consumed here as HSL channels, which keeps the shadcn primitives themeable
 * and stops one-off hex values creeping into components.
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.25rem', sm: '1.5rem', lg: '2rem', xl: '2.5rem' },
      screens: { '2xl': '1320px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // ── brand scale ───────────────────────────────────────────────────
        cream: 'hsl(var(--cream))',
        paper: 'hsl(var(--paper))',
        sand: 'hsl(var(--sand))',
        espresso: 'hsl(var(--espresso))',
        charcoal: 'hsl(var(--charcoal))',
        olive: 'hsl(var(--olive))',
        terracotta: 'hsl(var(--terracotta))',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Editorial display scale, tuned for the hero and section openers.
        'display-sm': ['clamp(2rem, 5vw, 2.75rem)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(2.5rem, 7vw, 4rem)', { lineHeight: '1.04', letterSpacing: '-0.025em' }],
        'display-lg': ['clamp(3rem, 9vw, 5.5rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        'eyebrow': ['0.6875rem', { lineHeight: '1', letterSpacing: '0.22em' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 3px)',
        sm: 'calc(var(--radius) - 5px)',
      },
      boxShadow: {
        // Restrained elevation — no large diffuse drop shadows.
        subtle: '0 1px 2px hsl(var(--espresso) / 0.04), 0 1px 1px hsl(var(--espresso) / 0.03)',
        card: '0 1px 3px hsl(var(--espresso) / 0.05), 0 8px 24px -12px hsl(var(--espresso) / 0.12)',
        lifted: '0 2px 6px hsl(var(--espresso) / 0.06), 0 18px 40px -18px hsl(var(--espresso) / 0.20)',
        header: '0 1px 0 hsl(var(--sand)), 0 4px 20px -8px hsl(var(--espresso) / 0.08)',
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'draw-check': {
          from: { strokeDashoffset: '48' },
          to: { strokeDashoffset: '0' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.8s infinite',
        'draw-check': 'draw-check 0.7s cubic-bezier(0.65, 0, 0.35, 1) 0.2s both',
        'accordion-down': 'accordion-down 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'accordion-up': 'accordion-up 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
