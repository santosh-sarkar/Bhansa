import type { NextFunction, Request, Response, ErrorRequestHandler } from 'express';
import multer from 'multer';

import { AppError } from '@/errors/AppError';
import type { ErrorCode } from '@/errors/errorCodes';
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

  // Handle multer errors
  if (error instanceof multer.MulterError) {
    let code: ErrorCode;
    let status: number;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_FIELD_KEY':
      case 'LIMIT_FIELD_VALUE':
      case 'LIMIT_FIELD_COUNT':
      case 'LIMIT_UNEXPECTED_FILE':
        code = 'VALIDATION_ERROR';
        status = 400;
        break;
      default:
        code = 'VALIDATION_ERROR';
        status = 400;
    }

    sendError(res, code, error.message, status);
    return;
  }

  // Handle file filter validation errors (thrown as regular Errors by multer's fileFilter)
  if (error instanceof Error && error.message.includes('Invalid file type')) {
    sendError(res, 'VALIDATION_ERROR', error.message, 400);
    return;
  }

  logger.error({ err: error, reqId: req.id }, 'unhandled error');
  sendError(res, 'INTERNAL_ERROR', 'Internal server error', 500);
};
