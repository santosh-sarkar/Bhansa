import type { NextFunction, Request, Response, ErrorRequestHandler } from 'express';

import { AppError } from '@/errors/AppError';
import { sendError } from '@/utils/response';
import { logger } from '@/lib/logger';

// Express recognises the global error handler by its four arguments; keep `_next`.
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof AppError) {
    sendError(res, error.code, error.message, error.status, error.details);
    return;
  }

  logger.error({ err: error, reqId: req.id }, 'unhandled error');
  sendError(res, 'INTERNAL_ERROR', 'Internal server error', 500);
};
