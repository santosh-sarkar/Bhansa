import { Router } from 'express';
import { z } from 'zod';

import {
  listPlansController,
  getPlanController,
  createPlanController,
  updatePlanController,
  deletePlanController,
} from '@/controllers/super-admin/plan.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireSuperAdmin } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const superAdminPlanRouter = Router();

// Validation schemas (inline)
const planIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const createPlanSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(32),
    name: z.string().min(1).max(64),
    price_monthly: z.string().regex(/^\d+(\.\d{1,2})?$/),
    max_outlets: z.number().int().nonnegative(),
    max_staff: z.number().int().nullable(),
    max_menu_items: z.number().int().nullable(),
    multi_outlet_enabled: z.boolean(),
    features: z.record(z.string(), z.unknown()).optional(),
    is_public: z.boolean(),
  }),
});

const updatePlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(64).optional(),
    price_monthly: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    max_outlets: z.number().int().nonnegative().optional(),
    max_staff: z.number().int().nullable().optional(),
    max_menu_items: z.number().int().nullable().optional(),
    multi_outlet_enabled: z.boolean().optional(),
    features: z.record(z.string(), z.unknown()).optional(),
    is_public: z.boolean().optional(),
  }),
});

// All routes require authentication and Super Admin role
superAdminPlanRouter.use(authMiddleware);
superAdminPlanRouter.use(requireSuperAdmin);

// List plans
superAdminPlanRouter.get(
  '/super-admin/plans',
  listPlansController,
);

// Get plan by ID
superAdminPlanRouter.get(
  '/super-admin/plans/{id}',
  validate({ params: planIdSchema.shape.params }),
  getPlanController,
);

// Create plan
superAdminPlanRouter.post(
  '/super-admin/plans',
  validate({ body: createPlanSchema.shape.body }),
  createPlanController,
);

// Update plan
superAdminPlanRouter.patch(
  '/super-admin/plans/{id}',
  validate({ params: updatePlanSchema.shape.params, body: updatePlanSchema.shape.body }),
  updatePlanController,
);

// Delete plan
superAdminPlanRouter.delete(
  '/super-admin/plans/{id}',
  validate({ params: planIdSchema.shape.params }),
  deletePlanController,
);

export { superAdminPlanRouter };