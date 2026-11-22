import type { RequestHandler } from 'express';

import {
  listIngredients,
  getIngredient,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from '@/services/inventory/ingredient.service';
import { sendSuccess } from '@/utils/response';

export const listIngredientsController: RequestHandler = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      is_active,
      search,
    } = req.query as {
      page?: string;
      limit?: string;
      is_active?: string;
      search?: string;
    };

    const result = await listIngredients(req.user!, {
      page: Number(page),
      limit: Number(limit),
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
      search,
    });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const getIngredientController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const result = await getIngredient(req.user!, id);

    sendSuccess(res, { ingredient: result });
  } catch (error) {
    next(error);
  }
};

export const createIngredientController: RequestHandler = async (req, res, next) => {
  try {
    const { name, unit, default_cost, is_active } = req.body as {
      name: string;
      unit: string;
      default_cost?: string | null;
      is_active?: boolean;
    };

    const result = await createIngredient(req.user!, { name, unit, default_cost, is_active });

    sendSuccess(res, { ingredient: result }, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateIngredientController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { name, unit, default_cost, is_active } = req.body as {
      name?: string;
      unit?: string;
      default_cost?: string | null;
      is_active?: boolean;
    };

    const result = await updateIngredient(req.user!, id, { name, unit, default_cost, is_active });

    sendSuccess(res, { ingredient: result });
  } catch (error) {
    next(error);
  }
};

export const deleteIngredientController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const result = await deleteIngredient(req.user!, id);

    sendSuccess(res, { ingredient: result });
  } catch (error) {
    next(error);
  }
};
