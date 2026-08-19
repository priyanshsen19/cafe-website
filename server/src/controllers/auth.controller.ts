import type { CookieOptions, Request, Response } from 'express';
import { isProd } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import * as authService from '../services/auth.service';
import * as users from '../repositories/user.repository';
import { prisma } from '../config/prisma';

const REFRESH_COOKIE = 'alaap_rt';

/**
 * The refresh token lives in an httpOnly cookie so page reloads can restore a
 * session without exposing a long-lived credential to JavaScript. The short-
 * lived access token is returned in the body and held in memory by the client.
 */
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register({ ...req.body, guestSessionId: req.cartSessionId });
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  res.status(201).json({ user: result.user, accessToken: result.accessToken });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login({ ...req.body, guestSessionId: req.cartSessionId });
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  res.json({ user: result.user, accessToken: result.accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) throw AppError.unauthorized();

  const result = await authService.refresh(token);
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  res.json({ user: result.user, accessToken: result.accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await users.findById(req.user!.id);
  if (!user) throw AppError.unauthorized();

  const [orderCount, spendAggregate, addressCount] = await Promise.all([
    prisma.order.count({ where: { userId: user.id, orderStatus: { not: 'CANCELLED' } } }),
    prisma.order.aggregate({
      where: { userId: user.id, orderStatus: { not: 'CANCELLED' } },
      _sum: { total: true },
    }),
    prisma.address.count({ where: { userId: user.id } }),
  ]);

  res.json({
    user,
    stats: {
      orderCount,
      totalSpent: spendAggregate._sum.total ?? 0,
      addressCount,
    },
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await users.updateUser(req.user!.id, req.body);
  res.json({ user });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions, maxAge: undefined });
  res.json({ ok: true, message: 'Password updated. Please sign in again.' });
});
