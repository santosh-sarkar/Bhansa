import { Router } from 'express';
import { z } from 'zod';

import {
  listSubscriptionsController,
  getSubscriptionController,
  updateSubscriptionOverridesController,
  extendTrialController,
  changePlanController,
} from '@/controllers/super-admin/subscription.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireSuperAdmin } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const superAdminSubscriptionRouter = Router();

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

const subscriptionDetailSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  organization_name: z.string(),
  plan_id: z.string().uuid(),
  plan_code: z.string(),
  plan_name: z.string(),
  status: z.enum(['trialing', 'active', 'grace', 'suspended', 'cancelled']),
  trial_ends_at: z.string().datetime().nullable(),
  grace_ends_at: z.string().datetime().nullable(),
  current_period_end: z.string().datetime().nullable(),
  max_outlets_override: z.number().int().nullable(),
  max_staff_override: z.number().int().nullable(),
  max_menu_items_override: z.number().int().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const subscriptionListSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  organization_name: z.string(),
  plan_id: z.string().uuid(),
  plan_code: z.string(),
  plan_name: z.string(),
  status: z.enum(['trialing', 'active', 'grace', 'suspended', 'cancelled']),
  trial_ends_at: z.string().datetime().nullable(),
  grace_ends_at: z.string().datetime().nullable(),
  current_period_end: z.string().datetime().nullable(),
  max_outlets_override: z.number().int().nullable(),
  max_staff_override: z.number().int().nullable(),
  max_menu_items_override: z.number().int().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const updateOverridesSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    max_outlets_override: z.number().int().nonnegative().nullable(),
    max_staff_override: z.number().int().nonnegative().nullable(),
    max_menu_items_override: z.number().int().nonnegative().nullable(),
  }),
});

const extendTrialSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    trial_ends_at: z.string().datetime(),
  }),
});

const changePlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    plan_id: z.string().uuid(),
    current_period_end: z.string().datetime().optional(),
  }),
});

const subscriptionIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

// OpenAPI paths
registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/subscriptions',
  tags: ['Super Admin', 'Subscriptions'],
  summary: 'List all subscriptions',
  description: 'Returns all subscriptions with organization and plan details. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: successResponse('Subscriptions list', z.array(subscriptionListSchema)),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/super-admin/subscriptions/{id}',
  tags: ['Super Admin', 'Subscriptions'],
  summary: 'Get subscription by ID',
  description: 'Returns detailed subscription information. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Subscription details', subscriptionDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Subscription not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/super-admin/subscriptions/{id}/overrides',
  tags: ['Super Admin', 'Subscriptions'],
  summary: 'Update subscription overrides',
  description: 'Updates subscription limit overrides (max outlets, staff, menu items). Set to null for unlimited. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            max_outlets_override: z.number().int().nonnegative().nullable(),
            max_staff_override: z.number().int().nonnegative().nullable(),
            max_menu_items_override: z.number().int().nonnegative().nullable(),
          }),
        },
      },
    },
  },
  responses: {
    200: successResponse('Subscription overrides updated', subscriptionDetailSchema),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Subscription not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/super-admin/subscriptions/{id}/extend-trial',
  tags: ['Super Admin', 'Subscriptions'],
  summary: 'Extend trial period',
  description: 'Extends the trial period for a subscription. Only allowed for subscriptions in trialing status. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            trial_ends_at: z.string().datetime(),
          }),
        },
      },
    },
  },
  responses: {
    200: successResponse('Trial extended', subscriptionDetailSchema),
    400: errorResponse('Validation error or subscription not in trialing status'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Subscription not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/super-admin/subscriptions/{id}/change-plan',
  tags: ['Super Admin', 'Subscriptions'],
  summary: 'Change subscription plan',
  description: 'Changes the plan for a subscription. Optionally updates current_period_end. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            plan_id: z.string().uuid(),
            current_period_end: z.string().datetime().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: successResponse('Plan changed', subscriptionDetailSchema),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Subscription or plan not found'),
  },
});

// All routes require authentication and Super Admin role
superAdminSubscriptionRouter.use(authMiddleware);
superAdminSubscriptionRouter.use(requireSuperAdmin);

// List subscriptions
superAdminSubscriptionRouter.get(
  '/super-admin/subscriptions',
  listSubscriptionsController,
);

// Get subscription by ID
superAdminSubscriptionRouter.get(
  '/super-admin/subscriptions/{id}',
  validate({ params: subscriptionIdSchema.shape.params }),
  getSubscriptionController,
);

// Update subscription overrides
superAdminSubscriptionRouter.patch(
  '/super-admin/subscriptions/{id}/overrides',
  validate({ params: updateOverridesSchema.shape.params, body: updateOverridesSchema.shape.body }),
  updateSubscriptionOverridesController,
);

// Extend trial
superAdminSubscriptionRouter.patch(
  '/super-admin/subscriptions/{id}/extend-trial',
  validate({ params: extendTrialSchema.shape.params, body: extendTrialSchema.shape.body }),
  extendTrialController,
);

// Change plan
superAdminSubscriptionRouter.patch(
  '/super-admin/subscriptions/{id}/change-plan',
  validate({ params: changePlanSchema.shape.params, body: changePlanSchema.shape.body }),
  changePlanController,
);

export { superAdminSubscriptionRouter };