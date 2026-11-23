import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';

import {
  submitSubscriptionPayment,
  reviewSubscriptionPayment,
  getSubscriptionPaymentById,
  listSubscriptionPayments,
} from '@/services/plans/subscription-payment.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const submitSubscriptionPaymentController: RequestHandler = async (req, res, next) => {
  try {
    const { subscription_id, amount, reference, period_months } = req.body as {
      subscription_id: string;
      amount: string;
      reference: string;
      period_months?: number;
    };

    const payment = await submitSubscriptionPayment(req.user!, {
      subscription_id,
      amount: new Prisma.Decimal(amount),
      reference,
      period_months,
    });

    sendSuccess(res, payment, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const reviewSubscriptionPaymentController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { action } = req.body as { action: 'approve' | 'reject' };

    if (!['approve', 'reject'].includes(action)) {
      return next(new AppError('VALIDATION_ERROR', 'Action must be approve or reject', 400));
    }

    const payment = await reviewSubscriptionPayment(req.user!, id, action);

    sendSuccess(res, payment);
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPaymentController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const payment = await getSubscriptionPaymentById(req.user!, id);

    sendSuccess(res, payment);
  } catch (error) {
    next(error);
  }
};

export const listSubscriptionPaymentsController: RequestHandler = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, organization_id } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      organization_id?: string;
    };

    const result = await listSubscriptionPayments(req.user!, {
      page: Number(page),
      limit: Number(limit),
      status,
      organization_id,
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

// Import AppError
import { AppError } from '@/errors/AppError';