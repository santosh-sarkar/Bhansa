import type { RequestHandler } from 'express';

import {
  listRecipeItems,
  getRecipeItem,
  createRecipeItem,
  updateRecipeItem,
  deleteRecipeItem,
  bulkUpsertRecipe,
} from '@/services/menu/recipe.service';
import { sendSuccess } from '@/utils/response';

export const listRecipeItemsController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId } = req.params as { menuItemId: string };

    const result = await listRecipeItems(req.user!, menuItemId);

    sendSuccess(res, { items: result });
  } catch (error) {
    next(error);
  }
};

export const getRecipeItemController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId, ingredientId } = req.params as { menuItemId: string; ingredientId: string };

    const result = await getRecipeItem(req.user!, menuItemId, ingredientId);

    sendSuccess(res, { recipeItem: result });
  } catch (error) {
    next(error);
  }
};

export const createRecipeItemController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId } = req.params as { menuItemId: string };
    const { ingredient_id, quantity } = req.body as { ingredient_id: string; quantity: string };

    const result = await createRecipeItem(req.user!, menuItemId, { ingredient_id, quantity });

    sendSuccess(res, { recipeItem: result }, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateRecipeItemController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId, ingredientId } = req.params as { menuItemId: string; ingredientId: string };
    const { quantity } = req.body as { quantity?: string };

    const result = await updateRecipeItem(req.user!, menuItemId, ingredientId, { quantity });

    sendSuccess(res, { recipeItem: result });
  } catch (error) {
    next(error);
  }
};

export const deleteRecipeItemController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId, ingredientId } = req.params as { menuItemId: string; ingredientId: string };

    const result = await deleteRecipeItem(req.user!, menuItemId, ingredientId);

    sendSuccess(res, { recipeItem: result });
  } catch (error) {
    next(error);
  }
};

export const bulkUpsertRecipeController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId } = req.params as { menuItemId: string };
    const { items } = req.body as { items: Array<{ ingredient_id: string; quantity: string }> };

    const result = await bulkUpsertRecipe(req.user!, menuItemId, items);

    sendSuccess(res, { items: result });
  } catch (error) {
    next(error);
  }
};
