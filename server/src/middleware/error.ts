import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { isProd } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound(`No route matches ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'));
}

/**
 * Terminal error handler. Maps known failures onto safe customer-facing
 * messages; everything else becomes a generic 500 with the detail logged
 * server-side only.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: { message: 'That value is already in use.', code: 'DUPLICATE' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: { message: 'We couldn’t find what you were looking for.', code: 'NOT_FOUND' },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);

  res.status(500).json({
    error: {
      message: 'Something went wrong on our side. Please try again.',
      code: 'INTERNAL_ERROR',
      ...(isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}
