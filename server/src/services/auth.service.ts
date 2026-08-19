import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import {
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens';
import * as users from '../repositories/user.repository';
import type { PublicUser } from '../repositories/user.repository';
import { mergeGuestCart } from './cart.service';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(user: PublicUser): Promise<AuthResult> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshTokenExpiry() },
  });

  return { user, accessToken, refreshToken };
}

export async function register(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  guestSessionId?: string;
}): Promise<AuthResult> {
  const existing = await users.findByEmail(input.email);
  if (existing) {
    throw AppError.conflict('An account already exists with that email. Try signing in instead.', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await users.createUser({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
  });

  if (input.guestSessionId) await mergeGuestCart(input.guestSessionId, user.id);

  return issueTokens(user);
}

export async function login(input: { email: string; password: string; guestSessionId?: string }): Promise<AuthResult> {
  const record = await users.findByEmail(input.email);

  // Compare against a dummy hash when the account is absent so the response
  // time doesn't reveal whether an email is registered.
  const hash = record?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(input.password, hash);

  if (!record || !ok) {
    throw AppError.unauthorized('That email and password don’t match.', 'INVALID_CREDENTIALS');
  }

  const user: PublicUser = {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    role: record.role,
    createdAt: record.createdAt,
  };

  if (input.guestSessionId) await mergeGuestCart(input.guestSessionId, user.id);

  return issueTokens(user);
}

/**
 * Refresh with rotation: the presented token is consumed and replaced. A token
 * that is valid but absent from the database has already been used or revoked.
 */
export async function refresh(token: string): Promise<AuthResult> {
  const payload = verifyRefreshToken(token);
  const tokenHash = hashToken(token);

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.userId !== payload.sub || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => undefined);
    throw AppError.unauthorized();
  }

  const user = await users.findById(payload.sub);
  if (!user) throw AppError.unauthorized();

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  return issueTokens(user);
}

export async function logout(token?: string): Promise<void> {
  if (!token) return;
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const record = await users.findByIdWithPassword(userId);
  if (!record) throw AppError.unauthorized();

  const ok = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!ok) throw AppError.badRequest('Your current password is incorrect.', 'INVALID_PASSWORD');

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
  });

  // Signing out every other session is the safe default after a password change.
  await prisma.refreshToken.deleteMany({ where: { userId } });
}
