import type { RequestHandler } from 'express';

import {
  listOrders,
  getOrder,
  confirmOrder,
  rejectOrder,
  updateOrderStatus,
  cancelOrder,
  updateOrderItemStatus,
  getKitchenBoard,
  listSessions,
  requestBill,
  closeSession,
  createStaffOrder,
} from '@/services/order/order.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const listOrdersController: RequestHandler = async (req, res, next) => {
  try {
    const filters = req.query as unknown as {
      page: number;
      limit: number;
      status?: string;
      table_id?: string;
      date_from?: string;
      date_to?: string;
      session_id?: string;
    };

    const result = await listOrders(req.user!, {
      page: Number(filters.page) || 1,
      limit: Math.min(Number(filters.limit) || 20, 100),
      status: filters.status,
      table_id: filters.table_id,
      date_from: filters.date_from ? new Date(filters.date_from) : undefined,
      date_to: filters.date_to ? new Date(filters.date_to) : undefined,
      session_id: filters.session_id,
    });

    sendPaginated(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const order = await getOrder(req.user!, id);

    sendSuccess(res, order);
  } catch (error) {
    next(error);
  }
};

export const confirmOrderController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const result = await confirmOrder(req.user!, id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const rejectOrderController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };

    const result = await rejectOrder(req.user!, id, reason);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatusController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { status, reason } = req.body as { status: string; reason?: string };

    const result = await updateOrderStatus(req.user!, id, status, reason);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const cancelOrderController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };

    const result = await cancelOrder(req.user!, id, reason);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const updateOrderItemStatusController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const result = await updateOrderItemStatus(req.user!, id, status);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const getKitchenBoardController: RequestHandler = async (req, res, next) => {
  try {
    const { outlet_id } = req.query as { outlet_id?: string };

    const board = await getKitchenBoard(req.user!, outlet_id);

    sendSuccess(res, board);
  } catch (error) {
    next(error);
  }
};

export const listSessionsController: RequestHandler = async (req, res, next) => {
  try {
    const filters = req.query as unknown as {
      page: number;
      limit: number;
      outlet_id?: string;
      status?: string;
    };

    const result = await listSessions(req.user!, {
      page: Number(filters.page) || 1,
      limit: Math.min(Number(filters.limit) || 20, 100),
      outlet_id: filters.outlet_id,
      status: filters.status,
    });

    sendPaginated(res, result.items, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const requestBillController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const result = await requestBill(req.user!, id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const closeSessionController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const result = await closeSession(req.user!, id);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const createStaffOrderController: RequestHandler = async (req, res, next) => {
  try {
    const { table_id, items, notes } = req.body as {
      table_id: string;
      items: Array<{
        menuItemId: string;
        quantity: number;
        options?: Array<{ optionId: string; quantity: number }>;
        notes?: string;
      }>;
      notes?: string;
    };

    const result = await createStaffOrder(req.user!, { tableId: table_id, items, notes });

    sendSuccess(res, result, { status: 201 });
  } catch (error) {
    next(error);
  }
};
