import { z } from 'zod';

import { registry } from '@/swagger';
import { listMenuItemOptionsSchema } from '@/validations/menu/option.schema';
import { menuItemOptionIdSchema } from '@/validations/menu/option.schema';
import { createMenuItemOptionSchema } from '@/validations/menu/option.schema';
import { updateMenuItemOptionSchema } from '@/validations/menu/option.schema';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

const menuItemOptionSchema = z.object({
  id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  kind: z.enum(['variant', 'addon']),
  name: z.string(),
  price_delta: z.string(),
  is_active: z.boolean(),
});

const menuItemOptionListItemSchema = z.object({
  id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  kind: z.enum(['variant', 'addon']),
  name: z.string(),
  price_delta: z.string(),
  is_active: z.boolean(),
});

const menuItemIdParam = z.object({ menuItemId: z.string().uuid() });

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/items/{menuItemId}/options',
  tags: ['Menu'],
  summary: 'List menu item options',
  description:
    'Returns paginated list of options (variants/addons) for a menu item. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemIdParam,
    query: listMenuItemOptionsSchema.shape.query,
  },
  responses: {
    200: {
      description: 'Options list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(menuItemOptionListItemSchema),
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Menu item not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/items/{menuItemId}/options/{id}',
  tags: ['Menu'],
  summary: 'Get option details',
  description: 'Returns option details. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemOptionIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Option details', z.object({ option: menuItemOptionSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Option not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/menu/items/{menuItemId}/options',
  tags: ['Menu'],
  summary: 'Create a new option',
  description:
    'Creates a new option (variant or addon) for a menu item. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemIdParam,
    body: {
      content: {
        'application/json': { schema: createMenuItemOptionSchema.shape.body },
      },
    },
  },
  responses: {
    201: successResponse('Option created', z.object({ option: menuItemOptionSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Menu item not found'),
    409: errorResponse('Option name already exists for this menu item'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/menu/items/{menuItemId}/options/{id}',
  tags: ['Menu'],
  summary: 'Update option',
  description:
    'Updates option kind, name, price_delta, or active status. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemOptionIdSchema.shape.params,
    body: {
      content: { 'application/json': { schema: updateMenuItemOptionSchema.shape.body } },
    },
  },
  responses: {
    200: successResponse('Option updated', z.object({ option: menuItemOptionSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Option not found'),
    409: errorResponse('Option name already exists for this menu item'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/menu/items/{menuItemId}/options/{id}',
  tags: ['Menu'],
  summary: 'Delete option',
  description: 'Soft deletes an option (sets is_active=false). Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemOptionIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Option deactivated', z.object({ option: menuItemOptionSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Option not found'),
  },
});