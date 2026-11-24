import type { RequestHandler } from 'express';

import { getPlatformStats } from '@/services/super-admin/stats.service';
import { sendSuccess } from '@/utils/response';

export const getPlatformStatsController: RequestHandler = async (req, res, next) => {
  try {
    const stats = await getPlatformStats();
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};