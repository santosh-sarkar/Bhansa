import type { RequestHandler } from 'express';

import {
  getAnalyticsSummary,
  getRevenueByDay,
  getTopItems,
  getPeakHours,
} from '@/services/analytics/analytics.service';
import { sendSuccess } from '@/utils/response';

export const getAnalyticsSummaryController: RequestHandler = async (req, res, next) => {
  try {
    const { date_from, date_to, outlet_id } = req.query as {
      date_from?: string;
      date_to?: string;
      outlet_id?: string;
    };

    const summary = await getAnalyticsSummary(req.user!, {
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
      outlet_id,
    });

    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
};

export const getRevenueByDayController: RequestHandler = async (req, res, next) => {
  try {
    const { date_from, date_to, outlet_id } = req.query as {
      date_from?: string;
      date_to?: string;
      outlet_id?: string;
    };

    const data = await getRevenueByDay(req.user!, {
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
      outlet_id,
    });

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getTopItemsController: RequestHandler = async (req, res, next) => {
  try {
    const { date_from, date_to, outlet_id, limit = 10 } = req.query as {
      date_from?: string;
      date_to?: string;
      outlet_id?: string;
      limit?: string;
    };

    const data = await getTopItems(req.user!, {
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
      outlet_id,
      limit: Number(limit),
    });

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getPeakHoursController: RequestHandler = async (req, res, next) => {
  try {
    const { date_from, date_to, outlet_id } = req.query as {
      date_from?: string;
      date_to?: string;
      outlet_id?: string;
    };

    const data = await getPeakHours(req.user!, {
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
      outlet_id,
    });

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};