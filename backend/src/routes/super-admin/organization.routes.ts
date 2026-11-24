import { Router } from 'express';
import { z } from 'zod';

import {
  listOrganizationsController,
  getOrganizationDetailController,
  suspendOrganizationController,
  reactivateOrganizationController,
  deleteOrganizationController,
} from '@/controllers/super-admin/organization.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireSuperAdmin } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const superAdminOrgRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const successResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }) } },
});

const paginatedResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: {
    'application/json': {
      schema: z.object({
        success: z.literal(true),
        data: z.array(data),
        pagination: z.object({
          page: z.number().int().positive(),
          limit: z.number().int().positive(),
          total: z.number().int().nonnegative(),
          totalPages: z.number().int().nonnegative(),
        }),
      }),
    },
  },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

const organizationListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  currency: z.string(),
  outlet_count: z.number().int().nonnegative(),
  staff_count: z.number().int().nonnegative(),
  subscription_status: z.string().nullable(),
  subscription_plan: z.string().nullable(),
  trial_ends_at: z.string().datetime().nullable(),
  grace_ends_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable(),
});

const organizationDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  currency: z.string(),
  outlet_count: z.number().int().nonnegative(),
  staff_count: z.number().int().nonnegative(),
  subscription_status: z.string().nullable(),
  subscription_plan: z.string().nullable(),
  trial_ends_at: z.string().datetime().nullable(),
  grace_ends_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable(),
  outlets: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      is_active: z.boolean(),
      status: z.string(),
    }),
  ),
  staff: z.array(
    z.object({
      id: z.string().uuid(),
      email: z.string(),
      full_name: z.string(),
      is_active: z.boolean(),
      role: z.string(),
      outlet_id: z.string().uuid().nullable(),
    }),
  ),
  subscription: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      plan_name: z.string(),
      trial_ends_at: z.string().datetime().nullable(),
      grace_ends_at: z.string().datetime().nullable(),
      current_period_end: z.string().datetime().nullable(),
    })
    .nullable(),
  custom_plan_lead: z
    .object({
      id: z.string().uuid(),
      contact_name: z.string(),
      contact_email: z.string(),
      outlet_count: z.number().int().nullable(),
      handled: z.boolean(),
      created_at: z.string().datetime(),
    })
    .nullable(),
});

const listOrganizationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['pending', 'active', 'suspended']).optional(),
    search: z.string().optional(),
  }),
});

const organizationIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const successOnlySchema = z.object({ success: z.literal(true) });

registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/organizations',
  tags: ['Super Admin'],
  summary: 'List all organizations',
  description: 'Returns paginated list of all organizations with filters. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { query: listOrganizationsSchema.shape.query },
  responses: {
    200: paginatedResponse('Organizations list', organizationListItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/organizations/{id}',
  tags: ['Super Admin'],
  summary: 'Get organization details',
  description: 'Returns detailed organization information including outlets, staff, and subscription. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Organization details', organizationDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Organization not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/super-admin/organizations/{id}/suspend',
  tags: ['Super Admin'],
  summary: 'Suspend organization',
  description: 'Sets organization status to suspended. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Organization suspended', successOnlySchema),
    400: errorResponse('Already suspended'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Organization not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/super-admin/organizations/{id}/reactivate',
  tags: ['Super Admin'],
  summary: 'Reactivate organization',
  description: 'Sets organization status to active. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Organization reactivated', successOnlySchema),
    400: errorResponse('Already active'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Organization not found'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/super-admin/organizations/{id}',
  tags: ['Super Admin'],
  summary: 'Delete organization (soft delete)',
  description: 'Soft deletes organization by setting deleted_at and suspending. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Organization deleted', successOnlySchema),
    400: errorResponse('Already deleted'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Organization not found'),
  },
});

// All routes require authentication and Super Admin role
superAdminOrgRouter.use(authMiddleware);
superAdminOrgRouter.use(requireSuperAdmin);

// List organizations
superAdminOrgRouter.get(
  '/super-admin/organizations',
  validate({ query: listOrganizationsSchema.shape.query }),
  listOrganizationsController,
);

// Get organization details
superAdminOrgRouter.get(
  '/super-admin/organizations/{id}',
  validate({ params: organizationIdSchema.shape.params }),
  getOrganizationDetailController,
);

// Suspend organization
superAdminOrgRouter.post(
  '/super-admin/organizations/{id}/suspend',
  validate({ params: organizationIdSchema.shape.params }),
  suspendOrganizationController,
);

// Reactivate organization
superAdminOrgRouter.post(
  '/super-admin/organizations/{id}/reactivate',
  validate({ params: organizationIdSchema.shape.params }),
  reactivateOrganizationController,
);

// Soft delete organization
superAdminOrgRouter.delete(
  '/super-admin/organizations/{id}',
  validate({ params: organizationIdSchema.shape.params }),
  deleteOrganizationController,
);

export { superAdminOrgRouter };