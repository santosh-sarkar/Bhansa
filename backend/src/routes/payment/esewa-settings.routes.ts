import { Router } from 'express';
import { z } from 'zod';

import { getEsewaSettingsController, upsertEsewaSettingsController, deleteEsewaSettingsController } from '@/controllers/payment/esewa-settings.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

import './esewa-settings.docs';

const esewaSettingsRouter = Router();

// Validation schemas (inline)
const esewaSettingsInputSchema = z.object({
  product_code: z.string().min(1, 'Product code is required').max(64),
  secret_key: z.string().min(1, 'Secret key is required').max(128),
  is_test_mode: z.boolean().default(true),
  is_enabled: z.boolean().default(false),
});

const outletIdSchema = z.object({
  params: z.object({ outletId: z.string().uuid() }),
});

// All routes require authentication
esewaSettingsRouter.use(authMiddleware);

// Get eSewa settings - requires billing.manage permission
esewaSettingsRouter.get(
  '/outlets/{outletId}/esewa-settings',
  requireOrgPermission('billing.manage'),
  validate({ params: outletIdSchema.shape.params }),
  getEsewaSettingsController,
);

// Create/update eSewa settings - requires billing.manage permission
esewaSettingsRouter.put(
  '/outlets/{outletId}/esewa-settings',
  requireOrgPermission('billing.manage'),
  validate({ params: outletIdSchema.shape.params, body: esewaSettingsInputSchema }),
  upsertEsewaSettingsController,
);

// Delete eSewa settings - requires billing.manage permission
esewaSettingsRouter.delete(
  '/outlets/{outletId}/esewa-settings',
  requireOrgPermission('billing.manage'),
  validate({ params: outletIdSchema.shape.params }),
  deleteEsewaSettingsController,
);

export { esewaSettingsRouter };