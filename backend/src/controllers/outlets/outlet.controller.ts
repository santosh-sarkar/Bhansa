import type { RequestHandler } from 'express';

import {
  listOutlets,
  getOutlet,
  createOutlet,
  updateOutlet,
  deactivateOutlet,
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
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
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
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
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
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
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
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
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
      { id: req.user!.id, organization_id: req.user!.organization_id ?? null },
      id,
    );

    sendSuccess(res, { outlet });
  } catch (error) {
    next(error);
  }
};
