import type { RequestHandler } from 'express';

import {
  listMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from '@/services/menu/menu.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const listMenuItemsController: RequestHandler = async (req, res, next) => {
  try {
    const filters = req.query as unknown as {
      page: number;
      limit: number;
      category_id?: string;
      is_active?: boolean;
      is_veg?: boolean;
      search?: string;
    };

    const result = await listMenuItems(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      filters,
    );

    sendPaginated(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const getMenuItemController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const item = await getMenuItem(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      id,
    );

    sendSuccess(res, { item });
  } catch (error) {
    next(error);
  }
};

export const createMenuItemController: RequestHandler = async (req, res, next) => {
  try {
    const input = req.body as {
      category_id: string;
      name: string;
      description?: string;
      image_url?: string;
      base_price: number;
      is_veg?: boolean;
      prep_time_min?: number;
      sort_order?: number;
    };

    const item = await createMenuItem(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      input,
    );

    sendSuccess(res, { item }, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateMenuItemController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const input = req.body as {
      category_id?: string;
      name?: string;
      description?: string | null;
      image_url?: string | null;
      base_price?: number;
      is_veg?: boolean;
      prep_time_min?: number;
      sort_order?: number;
      is_active?: boolean;
    };

    const item = await updateMenuItem(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      id,
      input,
    );

    sendSuccess(res, { item });
  } catch (error) {
    next(error);
  }
};

export const deleteMenuItemController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const item = await deleteMenuItem(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      id,
    );

    sendSuccess(res, { item });
  } catch (error) {
    next(error);
  }
};
