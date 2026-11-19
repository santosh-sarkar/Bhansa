import type { RequestHandler } from 'express';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';

/**
 * Requires a permission code at the organization level.
 * Checks if the user has either:
 * 1. An organization-wide assignment (outlet_id = null) with the permission (Owner)
 * 2. An outlet-level assignment with the permission (Manager)
 */
export function requireOrgPermission(permissionCode: string): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
      }

      if (!req.user.organization_id) {
        throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
      }

      const assignment = await prisma.staffAssignment.findFirst({
        where: {
          user_id: req.user.id,
          role: {
            rolePermissions: {
              some: { permission: { code: permissionCode } },
            },
          },
          OR: [
            { outlet_id: null }, // Organization-wide (Owner)
            { outlet: { organization_id: req.user.organization_id } }, // Outlet in same org (Manager)
          ],
        },
        select: { id: true },
      });

      if (!assignment) {
        throw new AppError('FORBIDDEN', 'Permission denied', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
