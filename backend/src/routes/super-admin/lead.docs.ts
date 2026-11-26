import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

const leadSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid().nullable(),
  organization_name: z.string().nullable(),
  contact_name: z.string(),
  contact_email: z.string().email(),
  outlet_count: z.number().int().nullable(),
  message: z.string().nullable(),
  handled: z.boolean(),
  created_at: z.string().datetime(),
});

const listLeadsQuerySchema = z.object({
  query: z.object({
    handled: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

const leadIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/leads',
  tags: ['Super Admin', 'Leads'],
  summary: 'List all custom plan leads',
  description: 'Returns paginated list of custom plan leads with optional filter by handled status. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { query: listLeadsQuerySchema.shape.query },
  responses: {
    200: {
      description: 'Leads list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(leadSchema),
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/leads/{id}',
  tags: ['Super Admin', 'Leads'],
  summary: 'Get lead by ID',
  description: 'Returns detailed lead information. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { params: leadIdSchema.shape.params },
  responses: {
    200: successResponse('Lead details', leadSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Lead not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/super-admin/leads/{id}/handled',
  tags: ['Super Admin', 'Leads'],
  summary: 'Mark lead as handled',
  description: 'Marks a custom plan lead as handled. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { params: leadIdSchema.shape.params },
  responses: {
    200: successResponse('Lead marked as handled', leadSchema),
    400: errorResponse('Lead already handled'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Lead not found'),
  },
});