import { Router } from 'express';
import { z } from 'zod';

import { getHealth } from '@/controllers/health/health.controller';
import { registry } from '@/docs/openapi';

const healthRouter: Router = Router();

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  checks: z.object({
    api: z.literal('ok'),
    database: z.literal('ok'),
    redis: z.literal('ok'),
  }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/health',
  tags: ['Health'],
  summary: 'Health check',
  description: 'Returns the health status of the API and its dependencies (database, Redis)',
  responses: {
    200: {
      description: 'All dependencies are healthy',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: healthResponseSchema,
          }),
        },
      },
    },
    503: {
      description: 'A dependency is unavailable',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.object({
              code: z.literal('INTERNAL_ERROR'),
              message: z.string(),
            }),
          }),
        },
      },
    },
  },
});

healthRouter.get('/health', getHealth);

export { healthRouter };
