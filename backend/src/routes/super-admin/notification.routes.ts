import { Router } from 'express';

import { getSuperAdminUnreadCountController } from '@/controllers/super-admin/notification.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireSuperAdmin } from '@/middlewares/orgPermission';

const superAdminNotificationRouter = Router();

// All routes require authentication and Super Admin role
superAdminNotificationRouter.use(authMiddleware);
superAdminNotificationRouter.use(requireSuperAdmin);

// Get unread notification count for super admin
superAdminNotificationRouter.get(
  '/super-admin/notifications/unread-count',
  getSuperAdminUnreadCountController,
);

export { superAdminNotificationRouter };