import { prisma } from '@/lib/prisma';

export interface PermissionUser {
  id: string;
  organization_id: string | null;
}

export interface PermissionOutlet {
  id: string;
  organization_id: string;
}

/**
 * Checks a permission code at an outlet. Permissions come from the user's staff
 * assignments, never from the access token.
 *
 * - An assignment with `outlet_id = NULL` applies to every outlet in the
 *   organization (Owner, per TRD).
 * - An outlet in another organization is always denied.
 * - Unknown permission codes are denied.
 */
export async function can(
  user: PermissionUser,
  outlet: PermissionOutlet,
  permissionCode: string,
): Promise<boolean> {
  if (!user.organization_id || outlet.organization_id !== user.organization_id) {
    return false;
  }

  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      user_id: user.id,
      OR: [{ outlet_id: outlet.id }, { outlet_id: null }],
      role: {
        rolePermissions: {
          some: { permission: { code: permissionCode } },
        },
      },
    },
    select: { id: true },
  });

  return assignment !== null;
}
