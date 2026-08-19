import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { isProd } from '../config/env';

const COOKIE = 'alaap_sid';

/**
 * Issues an anonymous session id so a guest can build a cart before signing in
 * — important for dine-in QR customers who scan a table and start ordering
 * immediately. The cart is merged into their account at login.
 */
export function cartSession(req: Request, res: Response, next: NextFunction) {
  let sid = req.cookies?.[COOKIE] as string | undefined;
  if (!sid || sid.length < 16) {
    sid = crypto.randomUUID();
    res.cookie(COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
  req.cartSessionId = sid;
  next();
}
