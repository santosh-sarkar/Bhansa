import type { RequestHandler } from 'express';

import {
  listMenuItemOptions,
  getMenuItemOption,
  createMenuItemOption,
  updateMenuItemOption,
  deleteMenuItemOption,
} from '@/services/menu/menu.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const listMenuItemOptionsController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId } = req.params as { menuItemId: string };
    const filters = req.query as unknown as {
      page: number;
      limit: number;
      kind?: string;
      is_active?: boolean;
    };

    const result = await listMenuItemOptions(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      menuItemId,
      filters,
    );

    sendPaginated(res, result.options, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const getMenuItemOptionController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId, id } = req.params as { menuItemId: string; id: string };

    const option = await getMenuItemOption(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      menuItemId,
      id,
    );

    sendSuccess(res, { option });
  } catch (error) {
    next(error);
  }
};

export const createMenuItemOptionController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId } = req.params as { menuItemId: string };
    const input = req.body as { kind: 'variant' | 'addon'; name: string; price_delta?: number };

    const option = await createMenuItemOption(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      menuItemId,
      input,
    );

    sendSuccess(res, { option }, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateMenuItemOptionController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId, id } = req.params as { menuItemId: string; id: string };
    const input = req.body as {
      kind?: 'variant' | 'addon';
      name?: string;
      price_delta?: number;
      is_active?: boolean;
    };

    const option = await updateMenuItemOption(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      menuItemId,
      id,
      input,
    );

    sendSuccess(res, { option });
  } catch (error) {
    next(error);
  }
};

export const deleteMenuItemOptionController: RequestHandler = async (req, res, next) => {
  try {
    const { menuItemId, id } = req.params as { menuItemId: string; id: string };

    const option = await deleteMenuItemOption(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      menuItemId,
      id,
    );

    sendSuccess(res, { option });
  } catch (error) {
    next(error);
  }
};
