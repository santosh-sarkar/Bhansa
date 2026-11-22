import type { RequestHandler } from 'express';

import {
  startOrJoinTableSession,
  getCurrentSession,
  requestBillPublic,
} from '@/services/public/public-session.service';
import { sendSuccess } from '@/utils/response';

export const startTableSessionController: RequestHandler = async (req, res, next) => {
  try {
    const { qrToken } = req.body as { qrToken: string };

    const result = await startOrJoinTableSession({ qrToken }, res);

    sendSuccess(res, result, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const getCurrentSessionController: RequestHandler = async (req, res, next) => {
  try {
    const result = await getCurrentSession(req);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const requestBillPublicController: RequestHandler = async (req, res, next) => {
  try {
    const result = await requestBillPublic(req);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
