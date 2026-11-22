import type { RequestHandler } from 'express';

import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/menu/menu.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const listCategoriesController: RequestHandler = async (req, res, next) => {
  try {
    const filters = req.query as unknown as {
      page: number;
      limit: number;
      is_active?: boolean;
      search?: string;
    };

    const result = await listCategories(req.user!, filters);

    sendPaginated(res, result.categories, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const category = await getCategory(req.user!, id);

    sendSuccess(res, { category });
  } catch (error) {
    next(error);
  }
};

export const createCategoryController: RequestHandler = async (req, res, next) => {
  try {
    const input = req.body as { name: string; sort_order?: number };

    const category = await createCategory(req.user!, input);

    sendSuccess(res, { category }, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateCategoryController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const input = req.body as { name?: string; sort_order?: number; is_active?: boolean };

    const category = await updateCategory(req.user!, id, input);

    sendSuccess(res, { category });
  } catch (error) {
    next(error);
  }
};

export const deleteCategoryController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const category = await deleteCategory(req.user!, id);

    sendSuccess(res, { category });
  } catch (error) {
    next(error);
  }
};
