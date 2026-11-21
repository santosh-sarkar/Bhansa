import type { RequestHandler } from 'express';

import {
  listOutlets,
  getOutlet,
  createOutlet,
  updateOutlet,
  deactivateOutlet,
  setActiveOutlet,
} from '@/services/outlets/outlet.service';
import { sendSuccess, sendPaginated } from '@/utils/response';

export const listOutletsController: RequestHandler = async (req, res, next) => {
  try {
    const filters = req.query as unknown as {
      page: number;
      limit: number;
      is_active?: boolean;
      search?: string;
    };

    const result = await listOutlets(
      req.user!,
      filters,
    );

    sendPaginated(res, result.outlets, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
};

export const getOutletController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const outlet = await getOutlet(
      req.user!,
      id,
    );

    sendSuccess(res, { outlet });
  } catch (error) {
    next(error);
  }
};

export const createOutletController: RequestHandler = async (req, res, next) => {
  try {
    const input = req.body as {
      name: string;
      address?: string;
      phone?: string;
      timezone?: string;
      tax_percent?: number;
      service_charge_percent?: number;
    };

    const outlet = await createOutlet(
      req.user!,
      input,
    );

    sendSuccess(res, { outlet }, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateOutletController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const input = req.body as {
      name?: string;
      address?: string;
      phone?: string;
      timezone?: string;
      tax_percent?: number;
      service_charge_percent?: number;
      is_active?: boolean;
    };

    const outlet = await updateOutlet(
      req.user!,
      id,
      input,
    );

    sendSuccess(res, { outlet });
  } catch (error) {
    next(error);
  }
};

export const deactivateOutletController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    const outlet = await deactivateOutlet(
      req.user!,
      id,
    );

    sendSuccess(res, { outlet });
  } catch (error) {
    next(error);
  }
};

export const setActiveOutletController: RequestHandler = async (req, res, next) => {
  try {
    const input = req.body as { outlet_id: string };

    const outlet = await setActiveOutlet(
      req.user!,
      input.outlet_id,
    );

    sendSuccess(res, { outlet });
  } catch (error) {
    next(error);
  }
};
