import type { RequestHandler } from 'express';

import { initiateEsewaPayment, verifyEsewaPayment } from '@/services/payment/esewa-initiate.service';
import { sendSuccess } from '@/utils/response';

export const initiateEsewaPaymentController: RequestHandler = async (req, res, next) => {
  try {
    const { billId } = req.params as { billId: string };
    const { return_url } = req.body as { return_url: string };

    if (!return_url) {
      return next(new AppError('VALIDATION_ERROR', 'return_url is required', 400));
    }

    const result = await initiateEsewaPayment(billId, return_url);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const verifyEsewaPaymentController: RequestHandler = async (req, res, next) => {
  try {
    const callbackData = req.body as Record<string, string>;

    const result = await verifyEsewaPayment(callbackData.transaction_uuid || '', callbackData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// Import AppError for the controller
import { AppError } from '@/errors/AppError';