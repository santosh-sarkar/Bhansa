import { Router } from 'express';
import { z } from 'zod';

import {
  listLeadsController,
  getLeadController,
  markLeadHandledController,
} from '@/controllers/super-admin/lead.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireSuperAdmin } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const superAdminLeadRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const successResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

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

const paginatedResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(leadSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
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

// OpenAPI paths
registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/leads',
  tags: ['Super Admin', 'Leads'],
  summary: 'List all custom plan leads',
  description: 'Returns paginated list of custom plan leads with optional filter by handled status. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { query: listLeadsQuerySchema.shape.query },
  responses: {
    200: successResponse('Leads list', paginatedResponseSchema),
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
  request: { params: z.object({ id: z.string().uuid() }) },
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
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Lead marked as handled', leadSchema),
    400: errorResponse('Lead already handled'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Lead not found'),
  },
});

// All routes require authentication and Super Admin role
superAdminLeadRouter.use(authMiddleware);
superAdminLeadRouter.use(requireSuperAdmin);

// List leads
superAdminLeadRouter.get(
  '/super-admin/leads',
  validate({ query: listLeadsQuerySchema.shape.query }),
  listLeadsController,
);

// Get lead by ID
superAdminLeadRouter.get(
  '/super-admin/leads/{id}',
  validate({ params: leadIdSchema.shape.params }),
  getLeadController,
);

// Mark lead as handled
superAdminLeadRouter.patch(
  '/super-admin/leads/{id}/handled',
  validate({ params: leadIdSchema.shape.params }),
  markLeadHandledController,
);

export { superAdminLeadRouter };