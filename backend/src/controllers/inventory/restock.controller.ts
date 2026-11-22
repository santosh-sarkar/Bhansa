import type { RequestHandler } from 'express';

import { recordRestock } from '@/services/inventory/restock.service';
import { sendSuccess } from '@/utils/response';

export const recordRestockController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const { ingredient_id, quantity, unit_cost, supplier, reason } = req.body as {
      ingredient_id: string;
      quantity: string;
      unit_cost?: string | null;
      supplier?: string | null;
      reason?: string | null;
    };

    const result = await recordRestock(req.user!, outletId, {
      ingredient_id,
      quantity,
      unit_cost,
      supplier,
      reason,
    });

    sendSuccess(res, result, { status: 201 });
  } catch (error) {
    next(error);
  }
};
