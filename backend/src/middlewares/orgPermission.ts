import type { RequestHandler } from 'express';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';

/**
 * Requires Super Admin role.
 */
export function requireSuperAdmin(): RequestHandler {
  return (req, _res, next) => {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
      }

      if (!req.user.is_super_admin) {
        throw new AppError('FORBIDDEN', 'Super Admin access required', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Requires a permission code at the organization level.
 * Checks if the user has either:
 * 1. An organization-wide assignment (outlet_id = null) with the permission (Owner)
 * 2. An outlet-level assignment with the permission (Manager)
 */
export function requireOrgPermission(permissionCode: string): RequestHandler {
  return async (req, _res, next) => {
    try {
      console.log(
        '[DEBUG] requireOrgPermission:',
        permissionCode,
        'user:',
        req.user?.id,
        'org:',
        req.user?.organization_id,
      );
      if (!req.user) {
        console.log('[DEBUG] requireOrgPermission: no user');
        throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
      }

      if (!req.user.organization_id) {
        console.log('[DEBUG] requireOrgPermission: no organization_id');
        throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
      }

      // Debug: check user's assignments
      const userAssignments = await prisma.staffAssignment.findMany({
        where: { user_id: req.user.id },
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      });
      console.log(
        '[DEBUG] User assignments:',
        userAssignments.map((a) => ({
          outlet_id: a.outlet_id,
          role: a.role?.code,
          permissions: a.role?.rolePermissions?.map((rp) => rp.permission?.code),
        })),
      );

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

      console.log('[DEBUG] requireOrgPermission: assignment found:', !!assignment);
      if (!assignment) {
        console.log('[DEBUG] requireOrgPermission: no assignment found');
        throw new AppError('FORBIDDEN', 'Permission denied', 403);
      }

      next();
    } catch (error) {
      console.error('[ERROR] requireOrgPermission:', error);
      next(error);
    }
  };
}
