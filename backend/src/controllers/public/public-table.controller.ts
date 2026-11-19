import type { RequestHandler } from 'express';

import { resolveQrToken } from '@/services/public/public-table.service';
import { sendSuccess } from '@/utils/response';

export const resolveQrTokenController: RequestHandler = async (req, res, next) => {
  try {
    const { qrToken } = req.params as { qrToken: string };

    const result = await resolveQrToken(qrToken);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
