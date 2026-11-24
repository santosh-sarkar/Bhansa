import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';

import {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} from '@/services/super-admin/plan.service';
import { sendSuccess } from '@/utils/response';

export const listPlansController: RequestHandler = async (req, res, next) => {
  try {
    const plans = await listPlans();
    sendSuccess(res, plans);
  } catch (error) {
    next(error);
  }
};

export const getPlanController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const plan = await getPlanById(id);
    sendSuccess(res, plan);
  } catch (error) {
    next(error);
  }
};

export const createPlanController: RequestHandler = async (req, res, next) => {
  try {
    const input = req.body as {
      code: string;
      name: string;
      price_monthly: string;
      max_outlets: number;
      max_staff: number | null;
      max_menu_items: number | null;
      multi_outlet_enabled: boolean;
      features?: Prisma.InputJsonValue;
      is_public: boolean;
    };

    const plan = await createPlan(input);
    sendSuccess(res, plan, { status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updatePlanController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const input = req.body as {
      name?: string;
      price_monthly?: string;
      max_outlets?: number;
      max_staff?: number | null;
      max_menu_items?: number | null;
      multi_outlet_enabled?: boolean;
      features?: Prisma.InputJsonValue;
      is_public?: boolean;
    };

    const plan = await updatePlan(id, input);
    sendSuccess(res, plan);
  } catch (error) {
    next(error);
  }
};

export const deletePlanController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const result = await deletePlan(id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};