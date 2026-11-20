import { Router } from 'express';
import { z } from 'zod';

import {
  listMenuItemOptionsController,
  getMenuItemOptionController,
  createMenuItemOptionController,
  updateMenuItemOptionController,
  deleteMenuItemOptionController,
} from '@/controllers/menu/option.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  listMenuItemOptionsSchema,
  menuItemOptionIdSchema,
  createMenuItemOptionSchema,
  updateMenuItemOptionSchema,
} from '@/validations/menu/option.schema';

const optionRouter = Router();

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

const menuItemOptionSchema = z.object({
  id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  kind: z.enum(['variant', 'addon']),
  name: z.string(),
  price_delta: z.string(), // Prisma.Decimal returned as string
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

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/items/{menuItemId}/options',
  tags: ['Menu'],
  summary: 'List menu item options',
  description:
    'Returns paginated list of options (variants/addons) for a menu item. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ menuItemId: z.string().uuid() }),
    query: listMenuItemOptionsSchema.shape.query,
  },
  responses: {
    200: paginatedResponse('Options list', menuItemOptionListItemSchema),
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
    params: z.object({ menuItemId: z.string().uuid() }),
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

// All routes require authentication
optionRouter.use(authMiddleware);

// List options - requires menu.edit permission
optionRouter.get(
  '/:menuItemId/options',
  requireOrgPermission('menu.edit'),
  validate({
    params: z.object({ menuItemId: z.string().uuid() }),
    query: listMenuItemOptionsSchema.shape.query,
  }),
  listMenuItemOptionsController,
);

// Get option details - requires menu.edit permission
optionRouter.get(
  '/:menuItemId/options/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemOptionIdSchema.shape.params }),
  getMenuItemOptionController,
);

// Create option - requires menu.edit permission
optionRouter.post(
  '/:menuItemId/options',
  requireOrgPermission('menu.edit'),
  validate({
    params: z.object({ menuItemId: z.string().uuid() }),
    body: createMenuItemOptionSchema.shape.body,
  }),
  createMenuItemOptionController,
);

// Update option - requires menu.edit permission
optionRouter.patch(
  '/:menuItemId/options/:id',
  requireOrgPermission('menu.edit'),
  validate({
    params: menuItemOptionIdSchema.shape.params,
    body: updateMenuItemOptionSchema.shape.body,
  }),
  updateMenuItemOptionController,
);

// Delete option - requires menu.edit permission
optionRouter.delete(
  '/:menuItemId/options/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemOptionIdSchema.shape.params }),
  deleteMenuItemOptionController,
);

export { optionRouter };
