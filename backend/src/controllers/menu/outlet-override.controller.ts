import type { RequestHandler } from 'express';

import {
  getMenuItemOutletOverrides,
  updateMenuItemOutletOverrides,
} from '@/services/menu/menu.service';
import { sendSuccess } from '@/utils/response';

export const getMenuItemOutletOverridesController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const overrides = await getMenuItemOutletOverrides(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      id,
    );

    sendSuccess(res, overrides);
  } catch (error) {
    next(error);
  }
};

export const updateMenuItemOutletOverridesController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { overrides } = req.body as {
      overrides: Array<{
        outlet_id: string;
        price_override?: number | null;
        is_available?: boolean;
        auto_unavailable?: boolean;
      }>;
    };

    const overrides_result = await updateMenuItemOutletOverrides(
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      id,
      overrides,
    );

    sendSuccess(res, overrides_result);
  } catch (error) {
    next(error);
  }
};
