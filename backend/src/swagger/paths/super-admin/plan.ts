import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const planDetailSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  price_monthly: z.string(),
  max_outlets: z.number().int().nonnegative(),
  max_staff: z.number().int().nullable(),
  max_menu_items: z.number().int().nullable(),
  multi_outlet_enabled: z.boolean(),
  features: z.record(z.string(), z.unknown()),
  is_public: z.boolean(),
  created_at: z.string().datetime(),
  subscription_count: z.number().int().nonnegative(),
});

const planListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  price_monthly: z.string(),
  max_outlets: z.number().int().nonnegative(),
  max_staff: z.number().int().nullable(),
  max_menu_items: z.number().int().nullable(),
  multi_outlet_enabled: z.boolean(),
  is_public: z.boolean(),
  subscription_count: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
});

const planIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const successOnlySchema = z.object({ success: z.literal(true) });

registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/plans',
  tags: ['Super Admin', 'Plans'],
  summary: 'List all plans',
  description: 'Returns all plans with subscription counts. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: successResponse('Plans list', z.array(planListItemSchema)),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/plans/{id}',
  tags: ['Super Admin', 'Plans'],
  summary: 'Get plan by ID',
  description: 'Returns detailed plan information including subscription count. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { params: planIdSchema.shape.params },
  responses: {
    200: successResponse('Plan details', planDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Plan not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/super-admin/plans',
  tags: ['Super Admin', 'Plans'],
  summary: 'Create a new plan',
  description: 'Creates a new subscription plan. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            code: z.string().min(1).max(32),
            name: z.string().min(1).max(64),
            price_monthly: z.string().regex(/^\d+(\.\d{1,2})?$/),
            max_outlets: z.number().int().nonnegative(),
            max_staff: z.number().int().nullable(),
            max_menu_items: z.number().int().nullable(),
            multi_outlet_enabled: z.boolean(),
            features: z.record(z.string(), z.unknown()).optional(),
            is_public: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    201: successResponse('Plan created', planDetailSchema),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    409: errorResponse('Plan code already exists'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/super-admin/plans/{id}',
  tags: ['Super Admin', 'Plans'],
  summary: 'Update a plan',
  description: 'Updates plan details. Code cannot be changed after creation. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(64).optional(),
            price_monthly: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
            max_outlets: z.number().int().nonnegative().optional(),
            max_staff: z.number().int().nullable().optional(),
            max_menu_items: z.number().int().nullable().optional(),
            multi_outlet_enabled: z.boolean().optional(),
            features: z.record(z.string(), z.unknown()).optional(),
            is_public: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: successResponse('Plan updated', planDetailSchema),
    400: errorResponse('Validation error or code cannot be changed'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Plan not found'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/super-admin/plans/{id}',
  tags: ['Super Admin', 'Plans'],
  summary: 'Delete a plan',
  description: 'Deletes a plan. Only allowed if no active subscriptions use it. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Plan deleted', successOnlySchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Plan not found'),
    409: errorResponse('Cannot delete plan with active subscriptions'),
  },
});