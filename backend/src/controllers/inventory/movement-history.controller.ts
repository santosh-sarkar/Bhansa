import type { RequestHandler } from 'express';

import { listStockMovements } from '@/services/inventory/movement-history.service';
import { sendPaginated } from '@/utils/response';

export const listStockMovementsController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const {
      page = 1,
      limit = 20,
      ingredient_id,
      type,
      start_date,
      end_date,
    } = req.query as {
      page?: string;
      limit?: string;
      ingredient_id?: string;
      type?: string;
      start_date?: string;
      end_date?: string;
    };

    const result = await listStockMovements(req.user!, outletId, {
      page: Number(page),
      limit: Number(limit),
      ingredient_id,
      type,
      start_date,
      end_date,
    });

    sendPaginated(res, result.movements, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};
