import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async controller so rejected promises reach the Express error
 * middleware instead of becoming unhandled rejections.
 */
export const asyncHandler =
  <T extends Request = Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    void Promise.resolve(fn(req as unknown as T, res, next)).catch(next);
  };
