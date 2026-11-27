import { Router } from 'express';

import { listStockMovementsController } from '@/controllers/inventory/movement-history.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import { listStockMovementsSchema } from '@/validations/inventory/movement-history.schema';

const movementHistoryRouter = Router();

// All routes require authentication
movementHistoryRouter.use(authMiddleware);

// List stock movements - requires inventory.view permission
movementHistoryRouter.get(
  '/outlets/:outletId/stock/movements',
  requireOrgPermission('inventory.view'),
  validate({ query: listStockMovementsSchema.shape.query }),
  listStockMovementsController,
);

export { movementHistoryRouter };