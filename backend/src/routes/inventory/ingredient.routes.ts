import { Router } from 'express';

import {
  listIngredientsController,
  getIngredientController,
  createIngredientController,
  updateIngredientController,
  deleteIngredientController,
} from '@/controllers/inventory/ingredient.controller';
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