import { Router } from 'express';
import { z } from 'zod';

import {
  getMenuItemOutletOverridesController,
  toggleMenuItemAvailabilityController,
  updateMenuItemOutletOverridesController,
} from '@/controllers/menu/outlet-override.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import { toggleAvailabilitySchema } from '@/validations/menu/outlet-override.schema';

const outletOverrideRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const overrideListItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  outlet_id: z.string().uuid(),
  price_override: z.string().nullable(),
  is_available: z.boolean(),
  auto_unavailable: z.boolean(),
  outlet: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/items/{id}/outlet-overrides',
  tags: ['Menu'],
  summary: 'Get outlet overrides for a menu item',
  description:
    'Returns outlet-specific price overrides and availability for a menu item. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Outlet overrides list',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(overrideListItemSchema),
          }),
        },
      },
    },
    401: {
      description: 'Unauthenticated',
      content: { 'application/json': { schema: errorSchema } },
    },
    403: { description: 'Forbidden', content: { 'application/json': { schema: errorSchema } } },
    404: {
      description: 'Menu item not found',
      content: { 'application/json': { schema: errorSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/menu/items/{id}/outlet-overrides',
  tags: ['Menu'],
  summary: 'Update outlet overrides for a menu item',
  description:
    'Bulk upserts outlet-specific price overrides and availability for a menu item. ' +
    'Owner can update overrides for any outlet in organization. Manager can only update for assigned outlets. ' +
    'Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            overrides: z.array(
              z.object({
                outlet_id: z.string().uuid(),
                price_override: z.number().positive().max(999999.99).nullable().optional(),
                is_available: z.boolean().optional(),
                auto_unavailable: z.boolean().optional(),
              }),
            ),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Outlet overrides updated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(
              z.object({
                menu_item_id: z.string().uuid(),
                outlet_id: z.string().uuid(),
                price_override: z.string().nullable(),
                is_available: z.boolean(),
                auto_unavailable: z.boolean(),
                outlet: z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                }),
              }),
            ),
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: errorSchema } },
    },
    401: {
      description: 'Unauthenticated',
      content: { 'application/json': { schema: errorSchema } },
    },
    403: {
      description: 'Forbidden or outlet access denied',
      content: { 'application/json': { schema: errorSchema } },
    },
    404: {
      description: 'Menu item or outlet not found',
      content: { 'application/json': { schema: errorSchema } },
    },
  },
});

outletOverrideRouter.use(authMiddleware);

outletOverrideRouter.get(
  '/:id/outlet-overrides',
  requireOrgPermission('menu.edit'),
  getMenuItemOutletOverridesController,
);

outletOverrideRouter.put(
  '/:id/outlet-overrides',
  requireOrgPermission('menu.edit'),
  validate({
    body: z.object({
      overrides: z.array(
        z.object({
          outlet_id: z.string().uuid(),
          price_override: z.number().positive().max(999999.99).nullable().optional(),
          is_available: z.boolean().optional(),
          auto_unavailable: z.boolean().optional(),
        }),
      ),
    }),
  }),
  updateMenuItemOutletOverridesController,
);

registry.registerPath({
  method: 'patch',
  path: '/api/v1/menu/items/{id}/availability',
  tags: ['Menu'],
  summary: 'Toggle menu item availability for an outlet',
  description:
    'Toggles the availability (is_available) of a menu item for a specific outlet. ' +
    'Owner can toggle for any outlet in organization. Manager can toggle for assigned outlets. ' +
    'Kitchen can toggle for assigned outlets. Requires item.mark_unavailable permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            outlet_id: z.string().uuid(),
            is_available: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Availability toggled',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              menu_item_id: z.string().uuid(),
              outlet_id: z.string().uuid(),
              price_override: z.string().nullable(),
              is_available: z.boolean(),
              auto_unavailable: z.boolean(),
              outlet: z.object({
                id: z.string().uuid(),
                name: z.string(),
              }),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: errorSchema } },
    },
    401: {
      description: 'Unauthenticated',
      content: { 'application/json': { schema: errorSchema } },
    },
    403: {
      description: 'Forbidden or outlet access denied',
      content: { 'application/json': { schema: errorSchema } },
    },
    404: {
      description: 'Menu item or outlet not found',
      content: { 'application/json': { schema: errorSchema } },
    },
  },
});

outletOverrideRouter.patch(
  '/:id/availability',
  requireOrgPermission('item.mark_unavailable'),
  validate({
    params: toggleAvailabilitySchema.shape.params,
    body: toggleAvailabilitySchema.shape.body,
  }),
  toggleMenuItemAvailabilityController,
);

export { outletOverrideRouter };
