const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

/**
 * The access token is deliberately held in memory only. The long-lived refresh
 * token lives in an httpOnly cookie the browser sends to /api/auth automatically,
 * so a reload restores the session without ever exposing a durable credential
 * to JavaScript.
 */
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(status: number, message: string, code = 'ERROR', details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set for endpoints that should not attempt a token refresh (login, refresh). */
  skipRefresh?: boolean;
}

async function parse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Refresh is shared: many parallel 401s must trigger exactly one refresh. */
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) return false;

      const data = (await response.json()) as { accessToken?: string };
      if (!data.accessToken) return false;

      accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Allow a later 401 to retry rather than caching a stale failure.
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipRefresh, headers, ...rest } = options;

  const send = async (): Promise<Response> =>
    fetch(`${BASE_URL}/api${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  let response: Response;
  try {
    response = await send();
  } catch {
    // Network-level failure: the server is unreachable or the request was blocked.
    throw new ApiError(0, 'We couldn’t reach the kitchen. Check your connection and try again.', 'NETWORK_ERROR');
  }

  // One transparent refresh-and-retry on an expired access token.
  if (response.status === 401 && !skipRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await send();
    } else {
      accessToken = null;
      onUnauthorized?.();
    }
  }

  const payload = await parse(response);

  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string; details?: Record<string, string> } })?.error;
    throw new ApiError(
      response.status,
      error?.message ?? 'Something went wrong. Please try again.',
      error?.code ?? 'ERROR',
      error?.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Turns a query object into a search string, dropping empty values.
 *
 * Takes a plain object rather than an index-signature type so callers can pass
 * their own named filter interfaces without restating them.
 */
export function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}

export { BASE_URL };
