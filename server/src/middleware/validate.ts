import type { NextFunction, Request, Response } from 'express';
import { ZodError, type AnyZodObject, type ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';

type Source = 'body' | 'query' | 'params';

function toFieldErrors(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Validates and *replaces* the request segment with the parsed result, so
 * controllers only ever see coerced, trusted shapes.
 */
export function validate(schema: AnyZodObject | ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      // req.query/params are getters on some Express versions; assign defensively.
      Object.defineProperty(req, source, { value: parsed, writable: true, configurable: true });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          AppError.unprocessable('Please check the highlighted fields.', 'VALIDATION_ERROR', toFieldErrors(error)),
        );
      }
      next(error);
    }
  };
}
