import express, { type Express } from 'express';

import { API_PREFIX } from '@/config/constants';
import { bodyLimitMiddleware } from '@/middlewares/bodyLimit';
import { cookieParserMiddleware } from '@/middlewares/cookieParser';
import { corsMiddleware } from '@/middlewares/cors';
import { errorHandler } from '@/middlewares/errorHandler';
import { helmetMiddleware } from '@/middlewares/helmet';
import { notFoundHandler } from '@/middlewares/notFoundHandler';
import { requestIdMiddleware } from '@/middlewares/requestId';
import { logger } from '@/lib/logger';
import { apiRouter } from '@/routes';

export function createApp(): Express {
  const app = express();

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParserMiddleware);
  app.use(bodyLimitMiddleware);

  app.use(requestIdMiddleware);

  app.use((req, _res, next) => {
    logger.info({ reqId: req.id, method: req.method, url: req.originalUrl }, 'request start');
    next();
  });

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
