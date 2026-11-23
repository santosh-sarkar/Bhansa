import type { RequestHandler } from 'express';

import { getEsewaSettings, upsertEsewaSettings, deleteEsewaSettings } from '@/services/payment/esewa-settings.service';
import { sendSuccess } from '@/utils/response';

export const getEsewaSettingsController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };

    const settings = await getEsewaSettings(req.user!, outletId);

    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
};

export const upsertEsewaSettingsController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };
    const { product_code, secret_key, is_test_mode, is_enabled } = req.body as {
      product_code: string;
      secret_key: string;
      is_test_mode?: boolean;
      is_enabled?: boolean;
    };

    const settings = await upsertEsewaSettings(req.user!, outletId, {
      product_code,
      secret_key,
      is_test_mode,
      is_enabled,
    });

    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
};

export const deleteEsewaSettingsController: RequestHandler = async (req, res, next) => {
  try {
    const { outletId } = req.params as { outletId: string };

    const result = await deleteEsewaSettings(req.user!, outletId);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};