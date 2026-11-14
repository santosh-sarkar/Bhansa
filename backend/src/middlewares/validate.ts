import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '@/errors/AppError';

export type ValidationSchemas = {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
};

export type ValidationIssue = {
  path: string;
  message: string;
};

type Section = keyof ValidationSchemas;

const SECTIONS: readonly Section[] = ['params', 'query', 'body'];

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    const parsed = new Map<Section, unknown>();
    const issues: ValidationIssue[] = [];

    for (const section of SECTIONS) {
      const schema = schemas[section];

      if (schema === undefined) {
        continue;
      }

      const result = schema.safeParse(req[section]);

      if (result.success) {
        parsed.set(section, result.data);
        continue;
      }

      for (const issue of result.error.issues) {
        issues.push({
          path: [section, ...issue.path.map(String)].join('.'),
          message: issue.message,
        });
      }
    }

    if (issues.length > 0) {
      next(new AppError('VALIDATION_ERROR', 'Validation failed', 400, issues));
      return;
    }

    if (parsed.has('params')) {
      req.params = parsed.get('params') as Request['params'];
    }

    if (parsed.has('query')) {
      // Express 5 exposes req.query as a getter; shadow it for this request.
      Object.defineProperty(req, 'query', {
        value: parsed.get('query'),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    if (parsed.has('body')) {
      req.body = parsed.get('body');
    }

    next();
  };
}
