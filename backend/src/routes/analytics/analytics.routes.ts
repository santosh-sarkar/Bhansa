import { Router } from 'express';

import {
  getAnalyticsSummaryController,
  getRevenueByDayController,
  getTopItemsController,
  getPeakHoursController,
} from '@/controllers/analytics/analytics.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

import './analytics.docs';

const analyticsRouter = Router();

// Validation schemas (inline)
import { z } from 'zod';

const analyticsFiltersSchema = z.object({
  query: z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    outlet_id: z.string().uuid().optional(),
  }),
});

const topItemsFiltersSchema = z.object({
  query: z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    outlet_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
});

// All routes require authentication
analyticsRouter.use(authMiddleware);

// Analytics summary - requires analytics.view permission
analyticsRouter.get(
  '/analytics/summary',
  requireOrgPermission('analytics.view'),
  validate({ query: analyticsFiltersSchema.shape.query }),
  getAnalyticsSummaryController,
);

// Revenue by day - requires analytics.view permission
analyticsRouter.get(
  '/analytics/revenue-by-day',
  requireOrgPermission('analytics.view'),
  validate({ query: analyticsFiltersSchema.shape.query }),
  getRevenueByDayController,
);

// Top items - requires analytics.view permission
analyticsRouter.get(
  '/analytics/top-items',
  requireOrgPermission('analytics.view'),
  validate({ query: topItemsFiltersSchema.shape.query }),
  getTopItemsController,
);

// Peak hours - requires analytics.view permission
analyticsRouter.get(
  '/analytics/peak-hours',
  requireOrgPermission('analytics.view'),
  validate({ query: analyticsFiltersSchema.shape.query }),
  getPeakHoursController,
);

export { analyticsRouter };