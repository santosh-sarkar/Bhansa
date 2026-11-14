import type { RequestHandler } from 'express';

import { prisma } from '@/lib/prisma';
import { sendSuccess } from '@/utils/response';

export const getMeController: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            currency: true,
            created_at: true,
          },
        },
        staffAssignments: {
          select: {
            id: true,
            role: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            outlet: {
              select: {
                id: true,
                name: true,
                is_active: true,
                timezone: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('Authenticated user not found');
    }

    const roleIds = [...new Set(user.staffAssignments.map((assignment) => assignment.role.id))];
    const rolePermissions =
      roleIds.length > 0
        ? await prisma.rolePermission.findMany({
            where: { role_id: { in: roleIds } },
            select: { permission: { select: { code: true } } },
          })
        : [];

    const permissions = [...new Set(rolePermissions.map((rp) => rp.permission.code))].sort();

    const lastOutlet = user.last_outlet_id
      ? await prisma.outlet.findFirst({
          where: {
            id: user.last_outlet_id,
            ...(user.organization_id ? { organization_id: user.organization_id } : {}),
          },
          select: { id: true, name: true, is_active: true, timezone: true },
        })
      : (user.staffAssignments[0]?.outlet ?? null);

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        is_super_admin: user.is_super_admin,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
      },
      organization: user.organization,
      assignments: user.staffAssignments.map((assignment) => ({
        id: assignment.id,
        outlet: assignment.outlet,
        role: assignment.role,
      })),
      permissions,
      last_outlet: lastOutlet,
    });
  } catch (error) {
    next(error);
  }
};
