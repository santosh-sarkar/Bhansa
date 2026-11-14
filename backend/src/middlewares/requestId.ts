import type { RequestHandler } from 'express';

import { randomUUID } from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';

export const requestIdMiddleware: RequestHandler = (req, _res, next) => {
  const existingId = req.headers[REQUEST_ID_HEADER];

  req.id = typeof existingId === 'string' && existingId.length > 0 ? existingId : randomUUID();

  next();
};
