import { z } from 'zod';

import { registry } from '@/swagger';
import { listIngredientsSchema } from '@/validations/inventory/ingredient.schema';
import { ingredientIdSchema } from '@/validations/inventory/ingredient.schema';
import { createIngredientSchema } from '@/validations/inventory/ingredient.schema';
import { updateIngredientSchema } from '@/validations/inventory/ingredient.schema';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

const ingredientDetailSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  unit: z.string(),
  default_cost: z.string().nullable(),
  is_active: z.boolean(),
  outletStock: z
    .array(
      z.object({
        outlet_id: z.string().uuid(),
        quantity: z.string(),
        low_threshold: z.string(),
        outlet: z.object({
          id: z.string().uuid(),
          name: z.string(),
        }),
      }),
    )
    .optional(),
});

const ingredientListItemSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  unit: z.string(),
  default_cost: z.string().nullable(),
  is_active: z.boolean(),
  _count: z
    .object({
      outletStock: z.number().int(),
      recipeItems: z.number().int(),
    })
    .optional(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/inventory/ingredients',
  tags: ['Inventory'],
  summary: 'List ingredients',
  description:
    'Returns paginated list of ingredients for the organization. Requires inventory.manage permission or organization-wide access (Owner).',
  security: [{ cookieAuth: [] }],
  request: {
    query: listIngredientsSchema.shape.query,
  },
  responses: {
    200: {
      description: 'Ingredients list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(ingredientListItemSchema),
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/inventory/ingredients/{id}',
  tags: ['Inventory'],
  summary: 'Get ingredient details',
  description:
    'Returns ingredient details with its outlet stock. Requires inventory.manage permission or organization-wide access (Owner).',
  security: [{ cookieAuth: [] }],
  request: {
    params: ingredientIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Ingredient details', z.object({ ingredient: ingredientDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Ingredient not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/inventory/ingredients',
  tags: ['Inventory'],
  summary: 'Create a new ingredient',
  description:
    'Creates a new ingredient in the organization. Requires inventory.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: createIngredientSchema.shape.body } },
    },
  },
  responses: {
    201: successResponse('Ingredient created', z.object({ ingredient: ingredientDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    409: errorResponse('Ingredient name already exists'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/inventory/ingredients/{id}',
  tags: ['Inventory'],
  summary: 'Update ingredient',
  description:
    'Updates ingredient name, unit, default cost, or active status. Requires inventory.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: ingredientIdSchema.shape.params,
    body: {
      content: { 'application/json': { schema: updateIngredientSchema.shape.body } },
    },
  },
  responses: {
    200: successResponse('Ingredient updated', z.object({ ingredient: ingredientDetailSchema })),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Ingredient not found'),
    409: errorResponse('Ingredient name already exists'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/inventory/ingredients/{id}',
  tags: ['Inventory'],
  summary: 'Delete ingredient',
  description:
    'Soft deletes an ingredient (sets is_active=false). Only allowed if ingredient has no outlet stock or recipe items. Requires inventory.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: ingredientIdSchema.shape.params,
  },
  responses: {
    200: successResponse(
      'Ingredient deactivated',
      z.object({ ingredient: ingredientDetailSchema }),
    ),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Ingredient not found'),
    409: errorResponse('Cannot delete ingredient with existing stock or recipes'),
  },
});