import type { RequestHandler } from 'express';

import { AppError } from '@/errors/AppError';
import { canAddMenuItem, canAddStaff, canCreateOutlet } from '@/services/plans';

/**
 * Middleware factory to check plan limits before creating resources.
 *
 * Usage:
 *   // For outlet creation
 *   router.post('/outlets', planLimitMiddleware('outlet'), createOutletController);
 *
 *   // For staff creation
 *   router.post('/staff', planLimitMiddleware('staff'), createStaffController);
 *
 *   // For menu item creation
 *   router.post('/menu-items', planLimitMiddleware('menuItem'), createMenuItemController);
 */
export function planLimitMiddleware(resource: 'outlet' | 'staff' | 'menuItem'): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user?.organization_id) {
        throw new AppError('FORBIDDEN', 'Organization context required', 403);
      }

      let checkResult: {
        allowed: boolean;
        current: number;
        limit: number | null;
      };

      if (resource === 'outlet') {
        checkResult = await canCreateOutlet(req.user.organization_id);
      } else if (resource === 'staff') {
        checkResult = await canAddStaff(req.user.organization_id);
      } else if (resource === 'menuItem') {
        checkResult = await canAddMenuItem(req.user.organization_id);
      } else {
        // This should never happen due to TypeScript's type checking, but handle it for safety
        const resourceStr = String(resource);
        throw new AppError('INTERNAL_ERROR', `Unknown resource type: ${resourceStr}`, 500);
      }

      if (!checkResult.allowed) {
        const limit = checkResult.limit ?? 'unlimited';
        const message = `Cannot create ${resource}: plan limit of ${limit} reached (current: ${checkResult.current})`;
        throw new AppError('PLAN_LIMIT_REACHED', message, 403, {
          resource,
          current: checkResult.current,
          limit: checkResult.limit,
        });
      }

      // Attach limit info to request for potential use in controller
      req.planLimitInfo = checkResult;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Extend Express Request type to include plan limit info
declare module 'express-serve-static-core' {
  interface Request {
    planLimitInfo?: {
      allowed: boolean;
      current: number;
      limit: number | null;
    };
  }
}
