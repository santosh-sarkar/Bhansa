import type { RequestHandler } from 'express';

import { recordAdjustment, recordWastage } from '@/services/inventory/adjustment.service';
import { sendSuccess } from '@/utils/response';

export const recordAdjustmentController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const { ingredient_id, quantity, unit_cost, reason } = req.body as {
      ingredient_id: string;
      quantity: string;
      unit_cost?: string | null;
      reason: string;
    };

    const result = await recordAdjustment(req.user!, outletId, {
      ingredient_id,
      quantity,
      unit_cost,
      reason,
    });

    sendSuccess(res, result, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const recordWastageController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const { ingredient_id, quantity, unit_cost, reason } = req.body as {
      ingredient_id: string;
      quantity: string;
      unit_cost?: string | null;
      reason: string;
    };

    const result = await recordWastage(req.user!, outletId, {
      ingredient_id,
      quantity,
      unit_cost,
      reason,
    });

    sendSuccess(res, result, { status: 201 });
  } catch (error) {
    next(error);
  }
};
