import type { RequestHandler } from 'express';

import {
  listOutletStock,
  getOutletStock,
  updateLowThreshold,
  bulkUpdateLowThreshold,
} from '@/services/inventory/outlet-stock.service';
import { sendSuccess } from '@/utils/response';

export const listOutletStockController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const {
      page = 1,
      limit = 20,
      is_low,
      search,
    } = req.query as {
      page?: string;
      limit?: string;
      is_low?: string;
      search?: string;
    };

    const isLowValue =
      (typeof is_low === 'string' && is_low === 'true') ||
      (typeof is_low === 'boolean' && is_low === true)
        ? true
        : (typeof is_low === 'string' && is_low === 'false') ||
            (typeof is_low === 'boolean' && is_low === false)
          ? false
          : undefined;
    const result = await listOutletStock(req.user!, outletId, {
      page: Number(page),
      limit: Number(limit),
      is_low: isLowValue,
      search,
    });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const getOutletStockController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, ingredientId } = req.params as { outletId: string; ingredientId: string };

    const result = await getOutletStock(req.user!, outletId, ingredientId);

    sendSuccess(res, { stock: result });
  } catch (error) {
    next(error);
  }
};

export const updateLowThresholdController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId, ingredientId } = req.params as { outletId: string; ingredientId: string };
    const { low_threshold } = req.body as { low_threshold: string };

    const result = await updateLowThreshold(req.user!, outletId, ingredientId, low_threshold);

    sendSuccess(res, { stock: result });
  } catch (error) {
    next(error);
  }
};

export const bulkUpdateLowThresholdController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const { items } = req.body as {
      items: Array<{ ingredient_id: string; low_threshold: string }>;
    };

    const result = await bulkUpdateLowThreshold(req.user!, outletId, items);

    sendSuccess(res, { items: result });
  } catch (error) {
    next(error);
  }
};
