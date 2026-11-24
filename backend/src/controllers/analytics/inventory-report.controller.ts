import type { RequestHandler } from 'express';

import {
  generateInventoryReport,
  generateConsolidatedInventoryReport,
} from '@/services/analytics/inventory-report.service';
import { sendSuccess } from '@/utils/response';

export const getInventoryReportController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const { date_from, date_to } = req.query as {
      date_from?: string;
      date_to?: string;
    };

    const report = await generateInventoryReport(req.user!, outletId, {
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
    });

    sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
};

export const getConsolidatedInventoryReportController: RequestHandler = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query as {
      date_from?: string;
      date_to?: string;
    };

    const report = await generateConsolidatedInventoryReport(req.user!, {
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
    });

    sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
};