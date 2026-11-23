import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';

import { recordCashPayment, getPaymentById, listPayments } from '@/services/payment/payment.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const recordCashPaymentController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { amount, idempotency_key } = req.body as {
      amount: string;
      idempotency_key?: string;
    };

    const payment = await recordCashPayment(req.user!, id, new Prisma.Decimal(amount), idempotency_key);

    sendSuccess(res, payment);
  } catch (error) {
    next(error);
  }
};

export const getPaymentController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const payment = await getPaymentById(req.user!, id);

    sendSuccess(res, payment);
  } catch (error) {
    next(error);
  }
};

export const listPaymentsController: RequestHandler = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, method, outlet_id, bill_id, date_from, date_to } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      method?: string;
      outlet_id?: string;
      bill_id?: string;
      date_from?: string;
      date_to?: string;
    };

    const result = await listPayments(req.user!, {
      page: Number(page),
      limit: Number(limit),
      status,
      method,
      outlet_id,
      bill_id,
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
    });

    sendPaginated(res, result.payments, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};