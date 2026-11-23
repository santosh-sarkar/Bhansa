import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';

import { generateBillForSession, getBillById, listBills } from '@/services/billing/bill.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const generateBillController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { discount_amount } = req.body as { discount_amount?: string };

    const discountAmount = discount_amount ? new Prisma.Decimal(discount_amount) : undefined;

    const bill = await generateBillForSession(req.user!, id, discountAmount);

    sendSuccess(res, bill);
  } catch (error) {
    next(error);
  }
};

export const getBillController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const bill = await getBillById(req.user!, id);

    sendSuccess(res, bill);
  } catch (error) {
    next(error);
  }
};

export const listBillsController: RequestHandler = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, outlet_id, date_from, date_to } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      outlet_id?: string;
      date_from?: string;
      date_to?: string;
    };

    const result = await listBills(req.user!, {
      page: Number(page),
      limit: Number(limit),
      status,
      outlet_id,
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
    });

    sendPaginated(res, result.bills, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};