import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const esewaSettingsDetailSchema = z.object({
  outlet_id: z.string().uuid(),
  provider: z.string(),
  product_code: z.string(),
  secret_key_encrypted: z.string(),
  is_test_mode: z.boolean(),
  is_enabled: z.boolean(),
  updated_at: z.string().datetime(),
});

const outletIdParam = z.object({ outletId: z.string().uuid() });

registry.registerPath({
  method: 'get',
  path: '/api/v1/outlets/{outletId}/esewa-settings',
  tags: ['Payments', 'Outlets'],
  summary: 'Get eSewa settings for an outlet',
  description: 'Returns eSewa configuration including encrypted secret key. Requires billing.manage permission.',
  security: [{ bearerAuth: [] }],
  request: { params: outletIdParam },
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
  security: [{ bearerAuth: [] }],
  request: {
    params: outletIdParam,
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
  security: [{ bearerAuth: [] }],
  request: { params: outletIdParam },
  responses: {
    200: successResponse('eSewa settings deleted', z.object({ success: z.literal(true) })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires billing.manage permission'),
    404: errorResponse('Outlet not found'),
  },
});
