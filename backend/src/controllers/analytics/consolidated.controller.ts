import type { RequestHandler } from 'express';

import { getConsolidatedAnalytics } from '@/services/analytics/consolidated.service';
import { sendSuccess } from '@/utils/response';

export const getConsolidatedAnalyticsController: RequestHandler = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query as {
      date_from?: string;
      date_to?: string;
    };

    const summary = await getConsolidatedAnalytics(req.user!, {
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
    });

    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
};