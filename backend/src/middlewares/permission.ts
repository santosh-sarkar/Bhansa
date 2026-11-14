import type { RequestHandler } from 'express';

import { AppError } from '@/errors/AppError';
import { can } from '@/services/authz/permission.service';

/**
 * Requires a permission code at the outlet attached by `outletContext`.
 * Deny by default: without an authenticated user or outlet context the request
 * is rejected instead of falling through.
 */
export function requirePermission(permissionCode: string): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
      }

      if (!req.outlet) {
        throw new AppError('FORBIDDEN', 'Outlet context required', 403);
      }

      const allowed = await can(req.user, req.outlet, permissionCode);

      if (!allowed) {
        throw new AppError('FORBIDDEN', 'Permission denied', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
