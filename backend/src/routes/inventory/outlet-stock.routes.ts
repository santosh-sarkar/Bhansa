import { Router } from 'express';
import { z } from 'zod';

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

import './outlet-stock.docs';

const outletStockRouter = Router({ mergeParams: true });

// Debug middleware
outletStockRouter.use((req, res, next) => {
  console.log(
    '[DEBUG] outletStockRouter hit:',
    req.method,
    req.path,
    'params:',
    req.params,
    'baseUrl:',
    req.baseUrl,
    'originalUrl:',
    req.originalUrl,
  );
  next();
});

// All routes require authentication
outletStockRouter.use(authMiddleware);

// List outlet stock - requires inventory.view permission
outletStockRouter.get(
  '/outlets/{outletId}/stock',
  (req, res, next) => {
    console.log('[DEBUG] Route handler reached, params:', req.params);
    next();
  },
  requireOrgPermission('inventory.view'),
  validate({ query: listOutletStockSchema.shape.query }),
  listOutletStockController,
);

// Get outlet stock detail - requires inventory.view permission
outletStockRouter.get(
  '/outlets/{outletId}/stock/{ingredientId}',
  requireOrgPermission('inventory.view'),
  validate({ params: outletStockIdSchema.shape.params }),
  getOutletStockController,
);

// Update low threshold - requires inventory.manage permission
outletStockRouter.patch(
  '/outlets/{outletId}/stock/{ingredientId}',
  requireOrgPermission('inventory.manage'),
  validate({ params: outletStockIdSchema.shape.params, body: updateOutletStockSchema.shape.body }),
  updateLowThresholdController,
);

// Bulk update low thresholds - requires inventory.manage permission
outletStockRouter.put(
  '/outlets/{outletId}/stock/low-thresholds',
  requireOrgPermission('inventory.manage'),
  validate({
    params: z.object({ outletId: z.string().uuid() }),
    body: bulkUpdateLowThresholdSchema.shape.body,
  }),
  bulkUpdateLowThresholdController,
);

export { outletStockRouter };