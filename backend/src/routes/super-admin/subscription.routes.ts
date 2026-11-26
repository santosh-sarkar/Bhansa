import { Router } from 'express';
import { z } from 'zod';

import {
  listSubscriptionsController,
  getSubscriptionController,
  updateSubscriptionOverridesController,
  extendTrialController,
  changePlanController,
} from '@/controllers/super-admin/subscription.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireSuperAdmin } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

import './subscription.docs';

const superAdminSubscriptionRouter = Router();

// Validation schemas (inline)
const subscriptionIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const updateOverridesSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    max_outlets_override: z.number().int().nonnegative().nullable(),
    max_staff_override: z.number().int().nonnegative().nullable(),
    max_menu_items_override: z.number().int().nonnegative().nullable(),
  }),
});

const extendTrialSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    trial_ends_at: z.string().datetime(),
  }),
});

const changePlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    plan_id: z.string().uuid(),
    current_period_end: z.string().datetime().optional(),
  }),
});

// All routes require authentication and Super Admin role
superAdminSubscriptionRouter.use(authMiddleware);
superAdminSubscriptionRouter.use(requireSuperAdmin);

// List subscriptions
superAdminSubscriptionRouter.get(
  '/super-admin/subscriptions',
  listSubscriptionsController,
);

// Get subscription by ID
superAdminSubscriptionRouter.get(
  '/super-admin/subscriptions/{id}',
  validate({ params: subscriptionIdSchema.shape.params }),
  getSubscriptionController,
);

// Update subscription overrides
superAdminSubscriptionRouter.patch(
  '/super-admin/subscriptions/{id}/overrides',
  validate({ params: updateOverridesSchema.shape.params, body: updateOverridesSchema.shape.body }),
  updateSubscriptionOverridesController,
);

// Extend trial
superAdminSubscriptionRouter.patch(
  '/super-admin/subscriptions/{id}/extend-trial',
  validate({ params: extendTrialSchema.shape.params, body: extendTrialSchema.shape.body }),
  extendTrialController,
);

// Change plan
superAdminSubscriptionRouter.patch(
  '/super-admin/subscriptions/{id}/change-plan',
  validate({ params: changePlanSchema.shape.params, body: changePlanSchema.shape.body }),
  changePlanController,
);

export { superAdminSubscriptionRouter };