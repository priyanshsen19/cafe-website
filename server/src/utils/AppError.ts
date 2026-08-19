/**
 * Errors that are safe to show a customer. Anything thrown that is *not* an
 * AppError is treated as an internal fault and reported as a generic message,
 * so stack traces and database errors never reach the client.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new AppError(400, message, code, details);
  }

  static unauthorized(message = 'Your session has expired. Please sign in again.', code = 'UNAUTHORIZED') {
    return new AppError(401, message, code);
  }

  static forbidden(message = "You don't have access to this.", code = 'FORBIDDEN') {
    return new AppError(403, message, code);
  }

  static notFound(message = 'We couldn’t find what you were looking for.', code = 'NOT_FOUND') {
    return new AppError(404, message, code);
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(409, message, code);
  }

  static unprocessable(message: string, code = 'UNPROCESSABLE', details?: unknown) {
    return new AppError(422, message, code, details);
  }
}
