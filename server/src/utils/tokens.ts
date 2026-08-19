import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from './AppError';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: 'alaap',
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET, { issuer: 'alaap' }) as AccessTokenPayload;
  } catch {
    throw AppError.unauthorized();
  }
}

export function signRefreshToken(userId: string): string {
  return jwt.sign(
    // A random jti makes every issued token unique. Without it, two sign-ins in
    // the same second produce byte-identical JWTs (iat has second resolution),
    // which collide on the stored token's unique index.
    { sub: userId, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d`, issuer: 'alaap' } as SignOptions,
  );
}

export function verifyRefreshToken(token: string): { sub: string } {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'alaap' }) as { sub: string };
  } catch {
    throw AppError.unauthorized();
  }
}

/**
 * Refresh tokens are stored hashed — a leaked database dump should not hand an
 * attacker usable sessions.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}
