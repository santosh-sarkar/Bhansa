import { Router } from 'express';
import { z } from 'zod';

import {
  listRecipeItemsController,
  getRecipeItemController,
  createRecipeItemController,
  updateRecipeItemController,
  deleteRecipeItemController,
  bulkUpsertRecipeController,
} from '@/controllers/menu/recipe.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  createRecipeItemSchema,
  updateRecipeItemSchema,
  bulkUpsertRecipeSchema,
} from '@/validations/menu/recipe.schema';

const recipeRouter = Router();

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

const recipeItemDetailSchema = z.object({
  menu_item_id: z.string().uuid(),
  menu_item_name: z.string(),
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  quantity: z.string(),
});

const recipeItemListItemSchema = z.object({
  ingredient_id: z.string().uuid(),
  ingredient_name: z.string(),
  ingredient_unit: z.string(),
  quantity: z.string(),
});

const menuItemIdParamSchema = z.object({
  menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
});

const recipeItemIdParamSchema = z.object({
  menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }),
  ingredientId: z.string().uuid({ message: 'Invalid ingredient ID' }),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/items/{menuItemId}/recipe',
  tags: ['Menu'],
  summary: 'List recipe items for a menu item',
  description:
    'Returns all ingredients and quantities for a menu item. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemIdParamSchema,
  },
  responses: {
    200: successResponse(
      'Recipe items list',
      z.object({ items: z.array(recipeItemListItemSchema) }),
    ),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Menu item not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/menu/items/{menuItemId}/recipe/{ingredientId}',
  tags: ['Menu'],
  summary: 'Get recipe item details',
  description: 'Returns details of a specific recipe item. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: recipeItemIdParamSchema,
  },
  responses: {
    200: successResponse('Recipe item details', z.object({ recipeItem: recipeItemDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Recipe item not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/menu/items/{menuItemId}/recipe',
  tags: ['Menu'],
  summary: 'Add ingredient to recipe',
  description:
    'Adds an ingredient with quantity to a menu item recipe. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemIdParamSchema,
    body: {
      content: { 'application/json': { schema: createRecipeItemSchema.shape.body } },
    },
  },
  responses: {
    201: successResponse('Recipe item added', z.object({ recipeItem: recipeItemDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Menu item or ingredient not found'),
    409: errorResponse('Recipe item already exists'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/menu/items/{menuItemId}/recipe/{ingredientId}',
  tags: ['Menu'],
  summary: 'Update recipe item quantity',
  description:
    'Updates the quantity of an ingredient in a menu item recipe. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: recipeItemIdParamSchema,
    body: {
      content: { 'application/json': { schema: updateRecipeItemSchema.shape.body } },
    },
  },
  responses: {
    200: successResponse('Recipe item updated', z.object({ recipeItem: recipeItemDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Recipe item not found'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/menu/items/{menuItemId}/recipe/{ingredientId}',
  tags: ['Menu'],
  summary: 'Remove ingredient from recipe',
  description: 'Removes an ingredient from a menu item recipe. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: recipeItemIdParamSchema,
  },
  responses: {
    200: successResponse('Recipe item removed', z.object({ recipeItem: recipeItemDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Recipe item not found'),
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/menu/items/{menuItemId}/recipe',
  tags: ['Menu'],
  summary: 'Bulk upsert recipe',
  description:
    'Replaces all recipe items for a menu item with the provided list. Requires menu.edit permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: menuItemIdParamSchema,
    body: {
      content: { 'application/json': { schema: bulkUpsertRecipeSchema.shape.body } },
    },
  },
  responses: {
    200: successResponse('Recipe updated', z.object({ items: z.array(recipeItemListItemSchema) })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Menu item or ingredient not found'),
  },
});

// All routes require authentication
recipeRouter.use(authMiddleware);

// List recipe items - requires menu.edit permission
recipeRouter.get(
  '/:menuItemId/recipe',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemIdParamSchema }),
  listRecipeItemsController,
);

// Get recipe item - requires menu.edit permission
recipeRouter.get(
  '/:menuItemId/recipe/:ingredientId',
  requireOrgPermission('menu.edit'),
  validate({ params: recipeItemIdParamSchema }),
  getRecipeItemController,
);

// Add recipe item - requires menu.edit permission
recipeRouter.post(
  '/:menuItemId/recipe',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemIdParamSchema, body: createRecipeItemSchema.shape.body }),
  createRecipeItemController,
);

// Update recipe item - requires menu.edit permission
recipeRouter.patch(
  '/:menuItemId/recipe/:ingredientId',
  requireOrgPermission('menu.edit'),
  validate({ params: recipeItemIdParamSchema, body: updateRecipeItemSchema.shape.body }),
  updateRecipeItemController,
);

// Delete recipe item - requires menu.edit permission
recipeRouter.delete(
  '/:menuItemId/recipe/:ingredientId',
  requireOrgPermission('menu.edit'),
  validate({ params: recipeItemIdParamSchema }),
  deleteRecipeItemController,
);

// Bulk upsert recipe - requires menu.edit permission
recipeRouter.put(
  '/:menuItemId/recipe',
  requireOrgPermission('menu.edit'),
  validate({ params: menuItemIdParamSchema, body: bulkUpsertRecipeSchema.shape.body }),
  bulkUpsertRecipeController,
);

export { recipeRouter };
