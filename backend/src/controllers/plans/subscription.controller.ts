import type { RequestHandler } from 'express';

import { getSubscriptionDetail } from '@/services/plans/subscription.service';
import { sendSuccess } from '@/utils/response';

export const getSubscriptionController: RequestHandler = async (req, res, next) => {
  try {
    const subscription = await getSubscriptionDetail(req.user!.organization_id!);
    sendSuccess(res, { subscription });
  } catch (error) {
    next(error);
  }
};
