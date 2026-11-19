import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';

// Higher rank may manage lower or equal ranks; never a higher one.
export const ROLE_RANK: Record<string, number> = {
  owner: 4,
  manager: 3,
  waiter: 2,
  kitchen: 2,
};

export interface StaffActor {
  id: string;
  organization_id: string | null;
}

/**
 * Resolves the caller's role at the current outlet. Owner-style assignments
 * (`outlet_id = NULL`) apply to every outlet in the organization.
 */
export async function getActorRoleCode(actorId: string, outletId: string): Promise<string> {
  const directAssignment = await prisma.staffAssignment.findFirst({
    where: { user_id: actorId, outlet_id: outletId },
    select: { role: { select: { code: true } } },
  });

  if (directAssignment) {
    return directAssignment.role.code;
  }

  const organizationAssignment = await prisma.staffAssignment.findFirst({
    where: { user_id: actorId, outlet_id: null },
    select: { role: { select: { code: true } } },
  });

  if (!organizationAssignment) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  return organizationAssignment.role.code;
}

/**
 * Outlets where the caller holds `staff.manage`. An assignment with
 * `outlet_id = NULL` makes the caller organization-wide (Owner).
 */
export async function getManageableOutletIds(
  actor: StaffActor,
): Promise<{ organizationWide: boolean; outletIds: string[] }> {
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      user_id: actor.id,
      role: { rolePermissions: { some: { permission: { code: 'staff.manage' } } } },
    },
    select: { outlet_id: true },
  });

  const organizationWide = assignments.some((assignment) => assignment.outlet_id === null);
  const outletIds = [
    ...new Set(
      assignments.flatMap((assignment) => (assignment.outlet_id ? [assignment.outlet_id] : [])),
    ),
  ];

  return { organizationWide, outletIds };
}

/**
 * Outlets where the caller has any assignment. An assignment with
 * `outlet_id = NULL` makes the caller organization-wide (Owner).
 * Used for listing outlets the user can access.
 */
export async function getAccessibleOutletIds(
  actor: StaffActor,
): Promise<{ organizationWide: boolean; outletIds: string[] }> {
  const assignments = await prisma.staffAssignment.findMany({
    where: { user_id: actor.id },
    select: { outlet_id: true },
  });

  const organizationWide = assignments.some((assignment) => assignment.outlet_id === null);
  const outletIds = [
    ...new Set(
      assignments.flatMap((assignment) => (assignment.outlet_id ? [assignment.outlet_id] : [])),
    ),
  ];

  return { organizationWide, outletIds };
}
