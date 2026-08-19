import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/tokens';

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return null;
}

/** Hard gate: request fails with 401 unless a valid access token is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return next(AppError.unauthorized('Please sign in to continue.'));

  const payload = verifyAccessToken(token);
  req.user = { id: payload.sub, role: payload.role, email: payload.email };
  next();
}

/** Attaches the user when a token is present, but never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
  } catch {
    // An expired token on a public endpoint just means "treat as a guest".
  }
  next();
}

/** Role gate. Must be mounted after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('This area is restricted to café staff.'));
    }
    next();
  };
}
