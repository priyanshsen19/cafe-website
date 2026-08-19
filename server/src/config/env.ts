import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

/**
 * In plain development the server's own .env is authoritative.
 *
 * Dev launchers (and `concurrently` passing their environment through) often
 * inject PORT for the web app. Without overriding, the API would inherit the
 * Vite dev-server port and the two would fight over the same socket.
 *
 * Production is never overridden — real environment variables must win there.
 * Tests are never overridden either: the suite loads .env.test first, and
 * clobbering it would silently point the tests at the development database.
 */
const shouldOverride = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

config({ path: path.resolve(__dirname, '../../.env'), override: shouldOverride });

/**
 * Render (and most PaaS hosts) expose the service's own public URL. Preferring
 * it means SERVER_URL doesn't have to be hand-copied back into the dashboard
 * after the first deploy — which matters because the cookie policy is derived
 * from whether the client and API are on the same host.
 */
if (!process.env.SERVER_URL && process.env.RENDER_EXTERNAL_URL) {
  process.env.SERVER_URL = process.env.RENDER_EXTERNAL_URL;
}

/**
 * Environment is validated once, at boot. A misconfigured deployment should
 * fail loudly on startup rather than at the first request that needs a secret.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(24, 'JWT_SECRET must be at least 24 characters'),
  JWT_REFRESH_SECRET: z.string().min(24, 'JWT_REFRESH_SECRET must be at least 24 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  SERVER_URL: z.string().url().default('http://localhost:4000'),

  PAYMENT_MODE: z.enum(['razorpay', 'mock']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),

  /**
   * Explicit opt-in to run the simulated gateway on a production build.
   *
   * This exists for one purpose: a public *demonstration* deployment, where we
   * still want production security (HTTPS-only cookies, no debug output) but
   * have no real gateway credentials. It must be set deliberately, and the
   * server shouts about it on every boot — it is never the default.
   */
  ALLOW_MOCK_PAYMENTS: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((value) => value === 'true'),

  /** Load the demo catalogue on boot if the database has no products yet. */
  SEED_ON_EMPTY: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((value) => value === 'true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nInvalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Mock payments are a development affordance. Shipping them to a real business
 * would mean orders marked paid without money moving, so production refuses to
 * start unless a human has explicitly acknowledged that this is a demo.
 */
if (env.NODE_ENV === 'production' && env.PAYMENT_MODE === 'mock') {
  if (!env.ALLOW_MOCK_PAYMENTS) {
    // eslint-disable-next-line no-console
    console.error(
      '\nRefusing to start: PAYMENT_MODE=mock is not permitted when NODE_ENV=production.\n' +
        'Either configure RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET and set PAYMENT_MODE=razorpay,\n' +
        'or — for a demonstration deployment only — set ALLOW_MOCK_PAYMENTS=true.\n',
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.warn(
    '\n' +
      '  ┌─────────────────────────────────────────────────────────────┐\n' +
      '  │  DEMONSTRATION MODE — PAYMENTS ARE SIMULATED                │\n' +
      '  │  No money moves. Orders are marked paid by a fake gateway.  │\n' +
      '  │  Never run this configuration for a real business.          │\n' +
      '  └─────────────────────────────────────────────────────────────┘\n',
  );
}

if (env.PAYMENT_MODE === 'razorpay' && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)) {
  // eslint-disable-next-line no-console
  console.error('\nRefusing to start: PAYMENT_MODE=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.\n');
  process.exit(1);
}

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
