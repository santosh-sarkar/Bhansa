import { z } from 'zod';

import { registry } from '@/swagger';
import { createRecipeItemSchema } from '@/validations/menu/recipe.schema';
import { updateRecipeItemSchema } from '@/validations/menu/recipe.schema';
import { bulkUpsertRecipeSchema } from '@/validations/menu/recipe.schema';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
