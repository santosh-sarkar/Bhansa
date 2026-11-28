import type { RequestHandler } from 'express';

import { getUnreadCount } from '@/services/notification/notification.service';
import { sendSuccess } from '@/utils/response';

export const getSuperAdminUnreadCountController: RequestHandler = async (req, res, next) => {
  try {
    const result = await getUnreadCount(req.user!);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};