import { z } from 'zod';

import { registry } from '@/swagger';
import { errorResponse, successResponse } from '@/swagger/schemas/common';

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
    200: successResponse('All dependencies are healthy', healthResponseSchema),
    503: errorResponse('A dependency is unavailable'),
  },
});
