import { Router } from 'express';
import { z } from 'zod';

import {
  listIngredientsController,
  getIngredientController,
  createIngredientController,
  updateIngredientController,
  deleteIngredientController,
} from '@/controllers/inventory/ingredient.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  listIngredientsSchema,
  ingredientIdSchema,
  createIngredientSchema,
  updateIngredientSchema,
} from '@/validations/inventory/ingredient.schema';

const ingredientRouter = Router();

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
    200: paginatedResponse('Ingredients list', ingredientListItemSchema),
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

// All routes require authentication
ingredientRouter.use(authMiddleware);

// List ingredients - requires inventory.manage permission (organization-wide)
ingredientRouter.get(
  '/',
  requireOrgPermission('inventory.manage'),
  validate({ query: listIngredientsSchema.shape.query }),
  listIngredientsController,
);

// Get ingredient details - requires inventory.manage permission (organization-wide)
ingredientRouter.get(
  '/:id',
  requireOrgPermission('inventory.manage'),
  validate({ params: ingredientIdSchema.shape.params }),
  getIngredientController,
);

// Create ingredient - requires inventory.manage permission (organization-wide)
ingredientRouter.post(
  '/',
  requireOrgPermission('inventory.manage'),
  validate({ body: createIngredientSchema.shape.body }),
  createIngredientController,
);

// Update ingredient - requires inventory.manage permission (organization-wide)
ingredientRouter.patch(
  '/:id',
  requireOrgPermission('inventory.manage'),
  validate({ params: ingredientIdSchema.shape.params, body: updateIngredientSchema.shape.body }),
  updateIngredientController,
);

// Delete ingredient - requires inventory.manage permission (organization-wide)
ingredientRouter.delete(
  '/:id',
  requireOrgPermission('inventory.manage'),
  validate({ params: ingredientIdSchema.shape.params }),
  deleteIngredientController,
);

export { ingredientRouter };
