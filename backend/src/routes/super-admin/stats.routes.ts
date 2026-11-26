import { Router } from 'express';

import { getPlatformStatsController } from '@/controllers/super-admin/stats.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireSuperAdmin } from '@/middlewares/orgPermission';

import './stats.docs';

const superAdminStatsRouter = Router();

// All routes require authentication and Super Admin role
superAdminStatsRouter.use(authMiddleware);
superAdminStatsRouter.use(requireSuperAdmin);

// Get platform stats
superAdminStatsRouter.get(
  '/super-admin/stats',
  getPlatformStatsController,
);

export { superAdminStatsRouter };