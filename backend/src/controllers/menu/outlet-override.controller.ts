import type { RequestHandler } from 'express';

import {
  getMenuItemOutletOverrides,
  toggleMenuItemAvailability,
  updateMenuItemOutletOverrides,
} from '@/services/menu/menu.service';
import { sendSuccess } from '@/utils/response';

export const getMenuItemOutletOverridesController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const overrides = await getMenuItemOutletOverrides(req.user!, id);

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

    const overrides_result = await updateMenuItemOutletOverrides(req.user!, id, overrides);

    sendSuccess(res, overrides_result);
  } catch (error) {
    next(error);
  }
};

export const toggleMenuItemAvailabilityController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { outlet_id, is_available } = req.body as {
      outlet_id: string;
      is_available: boolean;
    };

    const override = await toggleMenuItemAvailability(req.user!, id, outlet_id, is_available);

    sendSuccess(res, override);
  } catch (error) {
    next(error);
  }
};
