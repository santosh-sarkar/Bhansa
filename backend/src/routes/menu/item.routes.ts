import { Router } from 'express';
import { z } from 'zod';

import {
  listMenuItemsController,
  getMenuItemController,
  createMenuItemController,
  updateMenuItemController,
  deleteMenuItemController,
} from '@/controllers/menu/item.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  listMenuItemsSchema,
  menuItemIdSchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from '@/validations/menu/item.schema';
import { planLimitMiddleware } from '@/middlewares/planLimit';

const itemRouter = Router();

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

const menuItemDetailSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  base_price: z.string(), // Prisma.Decimal returned as string
  is_veg: z.boolean().nullable(),
  prep_time_min: z.number().int().nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int(),
  created_at: z.string().datetime(),
  options: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.string(),
        name: z.string(),
        price_delta: z.string(), // Prisma.Decimal returned as string
        is_active: z.boolean(),
      }),
    )
    .optional(),
  outletOverrides: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        outlet_id: z.string().uuid(),
        price_override: z.string().nullable(), // Prisma.Decimal returned as string
        is_available: z.boolean(),
        auto_unavailable: z.boolean(),
      }),
    )
    .optional(),
  category: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      is_active: z.boolean(),
    })
    .optional(),
});

const menuItemListItemSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  base_price: z.string(), // Prisma.Decimal returned as string
  is_veg: z.boolean().nullable(),
  prep_time_min: z.number().int().nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int(),
  created_at: z.string().datetime(),
  _count: z
    .object({
      options: z.number().int(),
      outletOverrides: z.number().int(),
    })
    .optional(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/items',
  tags: ['Menu'],
  summary: 'List menu items',
  description:
    'Returns paginated list of menu items for the organization. Supports filtering by category, active status, vegetarian, and search. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    query: listMenuItemsSchema.shape.query,
  },
  responses: {
    200: paginatedResponse('Menu items list', menuItemListItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/items/{id}',
  tags: ['Menu'],
  summary: 'Get menu item details',
  description:
    'Returns menu item details with options and outlet overrides. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Menu item details', z.object({ item: menuItemDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Menu item not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/menu/items',
  tags: ['Menu'],
  summary: 'Create a new menu item',
  description:
    'Creates a new menu item in the organization. Requires menu.edit permission. Plan-gated by max_menu_items limit.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: createMenuItemSchema.shape.body },
      },
    },
  },
  responses: {
    201: successResponse('Menu item created', z.object({ item: menuItemDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or plan limit reached'),
    404: errorResponse('Category not found'),
    409: errorResponse('Item name already exists in category'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/menu/items/{id}',
  tags: ['Menu'],
  summary: 'Update menu item',
  description: 'Updates menu item fields. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemIdSchema.shape.params,
    body: {
      content: { 'application/json': { schema: updateMenuItemSchema.shape.body } },
    },
  },
  responses: {
    200: successResponse('Menu item updated', z.object({ item: menuItemDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Menu item not found'),
    409: errorResponse('Item name already exists in category'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/menu/items/{id}',
  tags: ['Menu'],
  summary: 'Delete menu item',
  description:
    'Soft deletes a menu item (sets is_active=false and deleted_at). Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Menu item deleted', z.object({ item: menuItemDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Menu item not found'),
  },
});

// All routes require authentication
itemRouter.use(authMiddleware);

// List menu items - requires menu.edit permission
itemRouter.get(
  '/',
  requireOrgPermission('menu.edit'),
  validate({ query: listMenuItemsSchema.shape.query }),
  listMenuItemsController,
);

// Get menu item details - requires menu.edit permission
itemRouter.get(
  '/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemIdSchema.shape.params }),
  getMenuItemController,
);

// Create menu item - requires menu.edit permission, plan-gated by max_menu_items
itemRouter.post(
  '/',
  requireOrgPermission('menu.edit'),
  validate({ body: createMenuItemSchema.shape.body }),
  planLimitMiddleware('menuItem'),
  createMenuItemController,
);

// Update menu item - requires menu.edit permission
itemRouter.patch(
  '/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemIdSchema.shape.params, body: updateMenuItemSchema.shape.body }),
  updateMenuItemController,
);

// Delete menu item - requires menu.edit permission
itemRouter.delete(
  '/:id',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemIdSchema.shape.params }),
  deleteMenuItemController,
);

export { itemRouter };
