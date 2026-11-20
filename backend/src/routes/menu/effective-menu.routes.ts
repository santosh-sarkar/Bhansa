import { Router } from 'express';
import { z } from 'zod';

import { getEffectiveMenuController } from '@/controllers/menu/effective-menu.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';

const effectiveMenuRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const effectiveMenuItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  base_price: z.string(),
  is_active: z.boolean(),
  image_url: z.string().nullable(),
  override_price: z.string().nullable(),
  is_available: z.boolean(),
});

const effectiveMenuCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sort_order: z.number().int(),
  items: z.array(effectiveMenuItemSchema),
});

const effectiveMenuSchema = z.object({
  categories: z.array(effectiveMenuCategorySchema),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/effective',
  tags: ['Menu'],
  summary: 'Get effective menu for the current outlet',
  description:
    'Returns the effective menu for the outlet specified in the X-Outlet-Id header. ' +
    'Includes active categories and items with outlet-specific price overrides and availability. ' +
    'Respects is_available and auto_unavailable from outlet overrides. ' +
    'Requires authentication and valid X-Outlet-Id header. ' +
    'Accessible by any staff member assigned to the outlet (Owner, Manager, Waiter, Kitchen).',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'Effective menu',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: effectiveMenuSchema,
          }),
        },
      },
    },
    400: {
      description: 'Validation error (missing or invalid X-Outlet-Id)',
      content: { 'application/json': { schema: errorSchema } },
    },
    401: {
      description: 'Unauthenticated',
      content: { 'application/json': { schema: errorSchema } },
    },
    403: {
      description: 'Forbidden (outlet access denied)',
      content: { 'application/json': { schema: errorSchema } },
    },
  },
});

// All routes require authentication and outlet context
effectiveMenuRouter.use(authMiddleware);
effectiveMenuRouter.use(outletContextMiddleware);

effectiveMenuRouter.get('/', getEffectiveMenuController);

export { effectiveMenuRouter };
