import { Router } from 'express';

import {
  recordAdjustmentController,
  recordWastageController,
} from '@/controllers/inventory/adjustment.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import { adjustmentSchema, wastageSchema } from '@/validations/inventory/adjustment.schema';

import './adjustment.docs';

const adjustmentRouter = Router();

// All routes require authentication
adjustmentRouter.use(authMiddleware);

// Record adjustment - requires inventory.adjust permission (Owner, Manager, Kitchen)
adjustmentRouter.post(
  '/outlets/:outletId/stock/adjust',
  requireOrgPermission('inventory.adjust'),
  validate({ params: adjustmentSchema.shape.params, body: adjustmentSchema.shape.body }),
  recordAdjustmentController,
);

// Record wastage - requires inventory.wastage permission (Owner, Manager, Kitchen)
adjustmentRouter.post(
  '/outlets/:outletId/stock/wastage',
  requireOrgPermission('inventory.wastage'),
  validate({ params: wastageSchema.shape.params, body: wastageSchema.shape.body }),
  recordWastageController,
);

export { adjustmentRouter };