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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nInvalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;

/** Mock payments are a development affordance and must never ship to prod. */
if (env.NODE_ENV === 'production' && env.PAYMENT_MODE === 'mock') {
  // eslint-disable-next-line no-console
  console.error(
    '\nRefusing to start: PAYMENT_MODE=mock is not permitted when NODE_ENV=production.\n' +
      'Configure RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET and set PAYMENT_MODE=razorpay.\n',
  );
  process.exit(1);
}

if (env.PAYMENT_MODE === 'razorpay' && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)) {
  // eslint-disable-next-line no-console
  console.error('\nRefusing to start: PAYMENT_MODE=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.\n');
  process.exit(1);
}

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
