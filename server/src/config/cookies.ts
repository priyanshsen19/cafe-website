import type { CookieOptions } from 'express';
import { env, isProd } from './env';

/**
 * Cookie policy, derived from how the app is actually deployed.
 *
 * In development the SPA and the API share `localhost`, so `SameSite=Lax` works
 * and is the safer default. In the usual production shape they don't — a static
 * host serves the client and a separate service host serves the API — and a Lax
 * cookie is simply never sent on those cross-site XHRs. The result would be a
 * login that appears to succeed and then evaporates on the next page load.
 *
 * So: when the two are on different hosts in production, the cookie must be
 * `SameSite=None`, which browsers only honour together with `Secure`.
 */
function isCrossSiteDeployment(): boolean {
  try {
    return new URL(env.CLIENT_URL).host !== new URL(env.SERVER_URL).host;
  } catch {
    return false;
  }
}

export const crossSite = isProd && isCrossSiteDeployment();

/** Shared base: never readable by scripts, HTTPS-only in production. */
function baseCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: crossSite ? 'none' : 'lax',
    ...(crossSite ? { partitioned: true } : {}),
  };
}

/**
 * The refresh token. Scoped to /api/auth so it is never attached to ordinary
 * API traffic — it only travels on the endpoints that can consume it.
 */
export function refreshCookieOptions(): CookieOptions {
  return {
    ...baseCookie(),
    path: '/api/auth',
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

/** Anonymous cart session, so a guest can build an order before signing in. */
export function cartSessionCookieOptions(): CookieOptions {
  return {
    ...baseCookie(),
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}
