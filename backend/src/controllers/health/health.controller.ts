import type { RequestHandler } from 'express';

import { isDatabaseUp } from '@/services/health/checkDatabase.service';
import { isRedisUp } from '@/services/health/checkRedis.service';
import { sendError, sendSuccess } from '@/utils/response';

export const getHealth: RequestHandler = async (_req, res, _next) => {
  const [databaseUp, redisUp] = await Promise.all([isDatabaseUp(), isRedisUp()]);

  if (!databaseUp) {
    sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
    return;
  }

  if (!redisUp) {
    sendError(res, 'INTERNAL_ERROR', 'Redis unavailable', 503);
    return;
  }

  sendSuccess(res, { status: 'ok', checks: { api: 'ok', database: 'ok', redis: 'ok' } });
};
