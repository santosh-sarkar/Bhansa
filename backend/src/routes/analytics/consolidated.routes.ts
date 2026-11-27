import { Router } from 'express';

import { getConsolidatedAnalyticsController } from '@/controllers/analytics/consolidated.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const consolidatedRouter = Router();

// Validation schemas (inline)
import { z } from 'zod';

const consolidatedFiltersSchema = z.object({
  query: z.object({
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),
});

// All routes require authentication
consolidatedRouter.use(authMiddleware);

// Consolidated analytics - requires analytics.view permission and Owner role
consolidatedRouter.get(
  '/analytics/consolidated',
  requireOrgPermission('analytics.view'),
  validate({ query: consolidatedFiltersSchema.shape.query }),
  getConsolidatedAnalyticsController,
);

export { consolidatedRouter };