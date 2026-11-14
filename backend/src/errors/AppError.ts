import type { ErrorCode } from '@/errors/errorCodes';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;

    if (details !== undefined) {
      this.details = details;
    }
  }
}
