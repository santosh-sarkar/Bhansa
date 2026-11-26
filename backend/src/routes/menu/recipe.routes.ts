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
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  createRecipeItemSchema,
  updateRecipeItemSchema,
  bulkUpsertRecipeSchema,
} from '@/validations/menu/recipe.schema';

import './recipe.docs';

const recipeRouter = Router();

// All routes require authentication
recipeRouter.use(authMiddleware);

// List recipe items - requires menu.edit permission
recipeRouter.get(
  '/:menuItemId/recipe',
  requireOrgPermission('menu.edit'),
  validate({ params: z.object({ menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }) }) }),
  listRecipeItemsController,
);

// Get recipe item - requires menu.edit permission
recipeRouter.get(
  '/:menuItemId/recipe/:ingredientId',
  requireOrgPermission('menu.edit'),
  validate({ params: z.object({ menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }), ingredientId: z.string().uuid({ message: 'Invalid ingredient ID' }) }) }),
  getRecipeItemController,
);

// Add recipe item - requires menu.edit permission
recipeRouter.post(
  '/:menuItemId/recipe',
  requireOrgPermission('menu.edit'),
  validate({ params: z.object({ menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }) }), body: createRecipeItemSchema.shape.body }),
  createRecipeItemController,
);

// Update recipe item - requires menu.edit permission
recipeRouter.patch(
  '/:menuItemId/recipe/:ingredientId',
  requireOrgPermission('menu.edit'),
  validate({ params: z.object({ menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }), ingredientId: z.string().uuid({ message: 'Invalid ingredient ID' }) }), body: updateRecipeItemSchema.shape.body }),
  updateRecipeItemController,
);

// Delete recipe item - requires menu.edit permission
recipeRouter.delete(
  '/:menuItemId/recipe/:ingredientId',
  requireOrgPermission('menu.edit'),
  validate({ params: z.object({ menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }), ingredientId: z.string().uuid({ message: 'Invalid ingredient ID' }) }) }),
  deleteRecipeItemController,
);

// Bulk upsert recipe - requires menu.edit permission
recipeRouter.put(
  '/:menuItemId/recipe',
  requireOrgPermission('menu.edit'),
  validate({ params: z.object({ menuItemId: z.string().uuid({ message: 'Invalid menu item ID' }) }), body: bulkUpsertRecipeSchema.shape.body }),
  bulkUpsertRecipeController,
);

export { recipeRouter };