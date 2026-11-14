import type { Response } from 'express';

import type { ErrorCode } from '@/errors/errorCodes';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
};

export type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta;
};

export type ErrorEnvelope = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

type SuccessOptions = {
  status?: number;
  meta?: PaginationMeta;
};

export function sendSuccess<T>(res: Response, data: T, options: SuccessOptions = {}): void {
  const body: SuccessEnvelope<T> = { success: true, data };

  if (options.meta !== undefined) {
    body.meta = options.meta;
  }

  res.status(options.status ?? 200).json(body);
}

export function sendError(
  res: Response,
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown,
): void {
  const error: ErrorEnvelope['error'] = { code, message };

  if (details !== undefined) {
    error.details = details;
  }

  const body: ErrorEnvelope = { success: false, error };
  res.status(status).json(body);
}
