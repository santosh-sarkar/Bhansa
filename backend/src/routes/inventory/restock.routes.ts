import { Router } from 'express';

import { recordRestockController } from '@/controllers/inventory/restock.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import { restockSchema } from '@/validations/inventory/restock.schema';

const restockRouter = Router();

// All routes require authentication
restockRouter.use(authMiddleware);

// Record restock - requires inventory.restock permission (Owner, Manager)
restockRouter.post(
  '/outlets/:outletId/stock/restock',
  requireOrgPermission('inventory.restock'),
  validate({ params: restockSchema.shape.params, body: restockSchema.shape.body }),
  recordRestockController,
);

export { restockRouter };