import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

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

const successOnlySchema = z.object({ success: z.literal(true) });

registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/organizations',
  tags: ['Super Admin'],
  summary: 'List all organizations',
  description: 'Returns paginated list of all organizations with filters. Requires Super Admin role.',
  security: [{ bearerAuth: [] }],
  request: { query: listOrganizationsSchema.shape.query },
  responses: {
    200: {
      description: 'Organizations list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(organizationListItemSchema),
        },
      },
    },
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Organization deleted', successOnlySchema),
    400: errorResponse('Already deleted'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Organization not found'),
  },
});
