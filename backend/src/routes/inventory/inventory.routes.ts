import { Router } from 'express';
import { z } from 'zod';

import { ingredientRouter } from '@/routes/inventory/ingredient.routes';
import {
  listOutletStockController,
  getOutletStockController,
  updateLowThresholdController,
  bulkUpdateLowThresholdController,
} from '@/controllers/inventory/outlet-stock.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';
import {
  listOutletStockSchema,
  outletStockIdSchema,
  updateOutletStockSchema,
  bulkUpdateLowThresholdSchema,
} from '@/validations/inventory/outlet-stock.schema';

const inventoryRouter = Router();

inventoryRouter.use('/ingredients', ingredientRouter);

// Outlet stock routes - mounted directly on inventory router
inventoryRouter.use(authMiddleware);

// List outlet stock
inventoryRouter.get(
  '/outlets/:outletId/stock',
  requireOrgPermission('inventory.view'),
  validate({ query: listOutletStockSchema.shape.query }),
  listOutletStockController,
);

// Get outlet stock detail
inventoryRouter.get(
  '/outlets/:outletId/stock/:ingredientId',
  requireOrgPermission('inventory.view'),
  validate({ params: outletStockIdSchema.shape.params }),
  getOutletStockController,
);

// Update low threshold
inventoryRouter.patch(
  '/outlets/:outletId/stock/:ingredientId',
  requireOrgPermission('inventory.manage'),
  validate({ params: outletStockIdSchema.shape.params, body: updateOutletStockSchema.shape.body }),
  updateLowThresholdController,
);

// Bulk update low thresholds
inventoryRouter.put(
  '/outlets/:outletId/stock/low-thresholds',
  requireOrgPermission('inventory.manage'),
  validate({
    params: z.object({ outletId: z.string().uuid() }),
    body: bulkUpdateLowThresholdSchema.shape.body,
  }),
  bulkUpdateLowThresholdController,
);

export { inventoryRouter };
