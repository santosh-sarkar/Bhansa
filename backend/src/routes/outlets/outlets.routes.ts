import { Router } from 'express';
import { z } from 'zod';

import {
  listOutletsController,
  getOutletController,
  createOutletController,
  updateOutletController,
  deactivateOutletController,
  setActiveOutletController,
} from '@/controllers/outlets/outlet.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import { requirePermission } from '@/middlewares/permission';
import { planLimitMiddleware } from '@/middlewares/planLimit';
import { validate } from '@/middlewares/validate';
import {
  listOutletsSchema,
  outletIdSchema,
  createOutletSchema,
  updateOutletSchema,
} from '@/validations/outlets/outlet.schema';
import { setActiveOutletSchema } from '@/validations/outlets/active-outlet.schema';

const outletsRouter = Router();

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

const outletHeaders = z.object({ 'X-Outlet-Id': z.string().uuid() });

const outletDetailSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  timezone: z.string(),
  tax_percent: z.string(),
  service_charge_percent: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

const outletListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  timezone: z.string(),
  tax_percent: z.string(),
  service_charge_percent: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets',
  tags: ['Outlets'],
  summary: 'List outlets the user can access',
  description:
    'Returns paginated list of outlets the authenticated user has access to. Owner sees all organization outlets. Manager/Waiter/Kitchen see only assigned outlets.',
  security: [{ cookieAuth: [] }],
  request: {
    query: listOutletsSchema.shape.query,
  },
  responses: {
    200: paginatedResponse('Outlets list', outletListItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets/{id}',
  tags: ['Outlets'],
  summary: 'Get outlet details',
  description:
    'Returns outlet details. User must have an assignment to this outlet or be organization-wide (Owner).',
  security: [{ cookieAuth: [] }],
  request: {
    params: outletIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Outlet details', z.object({ outlet: outletDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Outlet access denied'),
    404: errorResponse('Outlet not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/outlets',
  tags: ['Outlets'],
  summary: 'Create a new outlet',
  description:
    'Creates a new outlet in the organization. Only organization-wide staff (Owner) can create. Plan-gated by max_outlets limit.',
  security: [{ cookieAuth: [] }],
  request: {
    headers: outletHeaders,
    body: {
      content: {
        'application/json': { schema: createOutletSchema.shape.body },
      },
    },
  },
  responses: {
    201: successResponse('Outlet created', z.object({ outlet: outletDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or plan limit reached'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/outlets/{id}',
  tags: ['Outlets'],
  summary: 'Update outlet profile and settings',
  description:
    'Updates outlet details. Requires tables.manage permission at the outlet or organization-wide access (Owner).',
  security: [{ cookieAuth: [] }],
  request: {
    params: outletIdSchema.shape.params,
    body: {
      content: {
        'application/json': { schema: updateOutletSchema.shape.body },
      },
    },
  },
  responses: {
    200: successResponse('Outlet updated', z.object({ outlet: outletDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Outlet access denied'),
    404: errorResponse('Outlet not found'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/outlets/{id}/deactivate',
  tags: ['Outlets'],
  summary: 'Deactivate outlet',
  description:
    'Deactivates an outlet (blocks new orders, keeps history). Only organization-wide staff (Owner) can deactivate.',
  security: [{ cookieAuth: [] }],
  request: {
    params: outletIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Outlet deactivated', z.object({ outlet: outletDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Outlet not found'),
  },
});

// All routes require authentication
outletsRouter.use(authMiddleware);

// List outlets - accessible to all authenticated users in the organization
outletsRouter.get('/', validate({ query: listOutletsSchema.shape.query }), listOutletsController);

// Get outlet details - requires outlet context (X-Outlet-Id)
outletsRouter.get(
  '/:id',
  validate({ params: outletIdSchema.shape.params }),
  outletContextMiddleware,
  getOutletController,
);

// Create outlet - Owner only, plan-gated
outletsRouter.post(
  '/',
  validate({ body: createOutletSchema.shape.body }),
  outletContextMiddleware,
  requirePermission('outlets.manage'), // Owner has this
  planLimitMiddleware('outlet'),
  createOutletController,
);

// Update outlet - tables.manage or Owner
outletsRouter.patch(
  '/:id',
  validate({ params: outletIdSchema.shape.params, body: updateOutletSchema.shape.body }),
  outletContextMiddleware,
  requirePermission('tables.manage'),
  updateOutletController,
);

// Deactivate outlet - Owner only
outletsRouter.patch(
  '/:id/deactivate',
  validate({ params: outletIdSchema.shape.params }),
  outletContextMiddleware,
  requirePermission('outlets.manage'),
  deactivateOutletController,
);

// Set active outlet - Owner or Manager
const activeOutletResponseSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  timezone: z.string(),
  tax_percent: z.string(),
  service_charge_percent: z.string(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/outlets/me/active-outlet',
  tags: ['Outlets'],
  summary: 'Save last active outlet',
  description:
    'Saves the last active outlet for the current user. Owner can set any outlet in their organization. Manager can only set outlets they are assigned to.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: setActiveOutletSchema.shape.body },
      },
    },
  },
  responses: {
    200: successResponse('Active outlet saved', z.object({ outlet: activeOutletResponseSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    404: errorResponse('Outlet not found'),
  },
});

outletsRouter.patch(
  '/me/active-outlet',
  validate({ body: setActiveOutletSchema.shape.body }),
  setActiveOutletController,
);

export { outletsRouter };
