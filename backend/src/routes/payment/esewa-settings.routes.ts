import { Router } from 'express';
import { z } from 'zod';

import { getEsewaSettingsController, upsertEsewaSettingsController, deleteEsewaSettingsController } from '@/controllers/payment/esewa-settings.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const esewaSettingsRouter = Router();

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

const esewaSettingsDetailSchema = z.object({
  outlet_id: z.string().uuid(),
  provider: z.string(),
  product_code: z.string(),
  secret_key_encrypted: z.string(),
  is_test_mode: z.boolean(),
  is_enabled: z.boolean(),
  updated_at: z.string().datetime(),
});

const esewaSettingsInputSchema = z.object({
  product_code: z.string().min(1, 'Product code is required').max(64),
  secret_key: z.string().min(1, 'Secret key is required').max(128),
  is_test_mode: z.boolean().default(true),
  is_enabled: z.boolean().default(false),
});

const outletIdSchema = z.object({
  params: z.object({ outletId: z.string().uuid() }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets/{outletId}/esewa-settings',
  tags: ['Payments', 'Outlets'],
  summary: 'Get eSewa settings for an outlet',
  description: 'Returns eSewa configuration including encrypted secret key. Requires billing.manage permission.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ outletId: z.string().uuid() }) },
  responses: {
    200: successResponse('eSewa settings', esewaSettingsDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires billing.manage permission'),
    404: errorResponse('Outlet not found or eSewa settings not configured'),
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/outlets/{outletId}/esewa-settings',
  tags: ['Payments', 'Outlets'],
  summary: 'Create or update eSewa settings for an outlet',
  description: 'Configures eSewa payment settings. Secret key is encrypted before storage. Requires billing.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ outletId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            product_code: z.string().min(1).max(64),
            secret_key: z.string().min(1).max(128),
            is_test_mode: z.boolean().default(true),
            is_enabled: z.boolean().default(false),
          }),
        },
      },
    },
  },
  responses: {
    200: successResponse('eSewa settings created/updated', esewaSettingsDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires billing.manage permission'),
    404: errorResponse('Outlet not found'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/outlets/{outletId}/esewa-settings',
  tags: ['Payments', 'Outlets'],
  summary: 'Delete eSewa settings for an outlet',
  description: 'Removes eSewa configuration. Requires billing.manage permission.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ outletId: z.string().uuid() }) },
  responses: {
    200: successResponse('eSewa settings deleted', z.object({ success: z.literal(true) })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires billing.manage permission'),
    404: errorResponse('Outlet not found'),
  },
});

// All routes require authentication
esewaSettingsRouter.use(authMiddleware);

// Get eSewa settings - requires billing.manage permission
esewaSettingsRouter.get(
  '/outlets/{outletId}/esewa-settings',
  requireOrgPermission('billing.manage'),
  validate({ params: outletIdSchema.shape.params }),
  getEsewaSettingsController,
);

// Create/update eSewa settings - requires billing.manage permission
esewaSettingsRouter.put(
  '/outlets/{outletId}/esewa-settings',
  requireOrgPermission('billing.manage'),
  validate({ params: outletIdSchema.shape.params, body: esewaSettingsInputSchema }),
  upsertEsewaSettingsController,
);

// Delete eSewa settings - requires billing.manage permission
esewaSettingsRouter.delete(
  '/outlets/{outletId}/esewa-settings',
  requireOrgPermission('billing.manage'),
  validate({ params: outletIdSchema.shape.params }),
  deleteEsewaSettingsController,
);

export { esewaSettingsRouter };