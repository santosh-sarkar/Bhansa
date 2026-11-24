import type { RequestHandler } from 'express';

import {
  listSubscriptions,
  getSubscriptionById,
  updateSubscriptionOverrides,
  extendTrial,
  changePlan,
} from '@/services/super-admin/subscription.service';
import { sendSuccess } from '@/utils/response';

export const listSubscriptionsController: RequestHandler = async (req, res, next) => {
  try {
    const subscriptions = await listSubscriptions();
    sendSuccess(res, subscriptions);
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const subscription = await getSubscriptionById(id);
    sendSuccess(res, subscription);
  } catch (error) {
    next(error);
  }
};

export const updateSubscriptionOverridesController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const input = req.body as {
      max_outlets_override: number | null;
      max_staff_override: number | null;
      max_menu_items_override: number | null;
    };

    const subscription = await updateSubscriptionOverrides(id, input);
    sendSuccess(res, subscription);
  } catch (error) {
    next(error);
  }
};

export const extendTrialController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const input = req.body as {
      trial_ends_at: string;
    };

    const subscription = await extendTrial(id, input);
    sendSuccess(res, subscription);
  } catch (error) {
    next(error);
  }
};

export const changePlanController: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const input = req.body as {
      plan_id: string;
      current_period_end?: string;
    };

    const subscription = await changePlan(id, input);
    sendSuccess(res, subscription);
  } catch (error) {
    next(error);
  }
};