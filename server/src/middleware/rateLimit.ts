import rateLimit from 'express-rate-limit';
import { isProd } from '../config/env';

const message = { error: { message: 'Too many requests. Please slow down and try again shortly.', code: 'RATE_LIMITED' } };

/** Tight limit on credential endpoints to blunt brute-force attempts. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 10 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
  skipSuccessfulRequests: true,
});

/** Broad protection for the rest of the API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProd ? 120 : 2000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

/** Order creation and payment initiation are expensive; keep them modest. */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProd ? 20 : 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});
