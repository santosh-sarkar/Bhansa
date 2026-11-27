import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse } from '@/swagger/schemas/common';

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
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Menu item not found'),
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
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    404: errorResponse('Menu item or outlet not found'),
  },
});

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
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or outlet access denied'),
    404: errorResponse('Menu item or outlet not found'),
  },
});