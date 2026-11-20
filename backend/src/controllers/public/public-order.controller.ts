import type { RequestHandler } from 'express';

import { placePublicOrder, getPublicOrder } from '@/services/public/public-order.service';
import { sendSuccess } from '@/utils/response';

export const placeOrderController: RequestHandler = async (req, res, next) => {
  try {
    const input = req.body as {
      items: Array<{
        menuItemId: string;
        quantity: number;
        options?: Array<{ optionId: string; quantity: number }>;
      }>;
      idempotencyKey: string;
      notes?: string;
    };

    const result = await placePublicOrder(
      req as unknown as Parameters<typeof placePublicOrder>[0],
      input,
    );

    sendSuccess(res, result, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const getOrderController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const result = await getPublicOrder(req as unknown as Parameters<typeof getPublicOrder>[0], id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
