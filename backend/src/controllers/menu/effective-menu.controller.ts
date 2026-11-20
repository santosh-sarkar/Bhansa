import type { RequestHandler } from 'express';

import { getEffectiveMenuForOutlet } from '@/services/menu/menu.service';
import { sendSuccess } from '@/utils/response';

export const getEffectiveMenuController: RequestHandler = async (req, res, next) => {
  try {
    const outletId = req.outlet!.id;

    const effectiveMenu = await getEffectiveMenuForOutlet(outletId);

    sendSuccess(res, effectiveMenu);
  } catch (error) {
    next(error);
  }
};
