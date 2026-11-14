import type { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { AppError } from '@/errors/AppError';

const outletIdSchema = z.string().uuid();

/**
 * Resolves the untrusted `X-Outlet-Id` header into `req.outlet`.
 *
 * The header is accepted only when the outlet belongs to the user's
 * organization and the user has an assignment for it. An assignment with
 * `outlet_id = NULL` (Owner) covers every outlet in the organization.
 *
 * Inactive outlets still resolve: deactivated outlets reject new orders but
 * must stay visible in reports. Deleted outlets never resolve.
 */
export const outletContextMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHENTICATED', 'Authentication required', 401);
    }

    const parsedOutletId = outletIdSchema.safeParse(req.get('X-Outlet-Id'));

    if (!parsedOutletId.success) {
      throw new AppError('VALIDATION_ERROR', 'Valid X-Outlet-Id header is required', 400);
    }

    if (!req.user.organization_id) {
      throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
    }

    const outlet = await prisma.outlet.findFirst({
      where: {
        id: parsedOutletId.data,
        organization_id: req.user.organization_id,
        deleted_at: null,
        OR: [
          // Assigned to this outlet.
          { staffAssignments: { some: { user_id: req.user.id } } },
          // Owner-style assignment without an outlet covers the whole organization.
          {
            organization: {
              users: {
                some: {
                  id: req.user.id,
                  staffAssignments: { some: { outlet_id: null } },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        organization_id: true,
        name: true,
        is_active: true,
        timezone: true,
      },
    });

    if (!outlet) {
      throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
    }

    req.outlet = outlet;
    next();
  } catch (error) {
    next(error);
  }
};
