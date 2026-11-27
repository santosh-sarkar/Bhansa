import { Router } from 'express';
import { z } from 'zod';

import {
  getInventoryReportController,
  getConsolidatedInventoryReportController,
} from '@/controllers/analytics/inventory-report.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const inventoryReportRouter = Router();

// Validation schemas (inline)
const outletIdSchema = z.object({
  params: z.object({ outletId: z.string().uuid() }),
});

const inventoryFiltersSchema = z.object({
  query: z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),
});

const inventoryFiltersSchemaWithOutlet = z.object({
  query: z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),
});

// All routes require authentication
inventoryReportRouter.use(authMiddleware);

// Outlet inventory report - requires analytics.view permission
inventoryReportRouter.get(
  '/analytics/inventory/{outletId}',
  requireOrgPermission('analytics.view'),
  validate({ params: outletIdSchema.shape.params, query: inventoryFiltersSchemaWithOutlet.shape.query }),
  getInventoryReportController,
);

// Consolidated inventory report - requires analytics.view permission
inventoryReportRouter.get(
  '/analytics/inventory/consolidated',
  requireOrgPermission('analytics.view'),
  validate({ query: inventoryFiltersSchema.shape.query }),
  getConsolidatedInventoryReportController,
);

export { inventoryReportRouter };