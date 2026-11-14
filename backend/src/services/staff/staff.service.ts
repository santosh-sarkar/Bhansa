import type { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import {
  getActorRoleCode,
  getManageableOutletIds,
  ROLE_RANK,
  type StaffActor,
} from '@/services/staff/access';

const staffInclude = {
  staffAssignments: {
    include: {
      role: { select: { id: true, code: true, name: true } },
      outlet: { select: { id: true, name: true, is_active: true } },
    },
    orderBy: { outlet_id: 'asc' },
  },
} satisfies Prisma.UserInclude;

type StaffWithRelations = Prisma.UserGetPayload<{ include: typeof staffInclude }>;
type StaffAssignmentWithRelations = StaffWithRelations['staffAssignments'][number];

export interface StaffMemberResponse {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  assignments: Array<{
    id: string;
    role: { id: number; code: string; name: string };
    outlet: { id: string; name: string; is_active: boolean } | null;
  }>;
}

export interface CurrentOutlet {
  id: string;
  organization_id: string;
}

export interface ListStaffParams {
  actor: StaffActor;
  page: number;
  limit: number;
  status?: 'active' | 'inactive';
  roleCode?: string;
}

export interface ChangeStaffRoleParams {
  actor: StaffActor;
  currentOutlet: CurrentOutlet;
  staffId: string;
  roleCode: string;
}

export interface DeactivateStaffParams {
  actor: StaffActor;
  staffId: string;
}

function toAssignmentResponse(assignment: StaffAssignmentWithRelations) {
  return {
    id: assignment.id,
    role: assignment.role,
    outlet: assignment.outlet,
  };
}

function toStaffResponse(user: StaffWithRelations): StaffMemberResponse {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    phone: user.phone,
    is_active: user.is_active,
    last_login_at: user.last_login_at,
    created_at: user.created_at,
    assignments: user.staffAssignments.map(toAssignmentResponse),
  };
}

function isOwner(user: StaffWithRelations): boolean {
  return user.staffAssignments.some((assignment) => assignment.role.code === 'owner');
}

function assertCanManageTarget(
  actorIsOrganizationWide: boolean,
  manageableOutletIds: string[],
  target: StaffWithRelations,
): void {
  if (isOwner(target)) {
    if (!actorIsOrganizationWide) {
      throw new AppError('FORBIDDEN', 'Managers cannot manage Owners', 403);
    }

    return;
  }

  if (!actorIsOrganizationWide) {
    const outsideManagedOutlets = target.staffAssignments.some(
      (assignment) =>
        assignment.outlet_id === null || !manageableOutletIds.includes(assignment.outlet_id),
    );

    if (outsideManagedOutlets) {
      throw new AppError('FORBIDDEN', 'Staff member is outside your outlets', 403);
    }
  }
}

async function findStaffTarget(
  staffId: string,
  organizationId: string,
): Promise<StaffWithRelations> {
  const target = await prisma.user.findFirst({
    where: {
      id: staffId,
      organization_id: organizationId,
      staffAssignments: { some: {} },
    },
    include: staffInclude,
  });

  if (!target) {
    throw new AppError('NOT_FOUND', 'Staff member not found', 404);
  }

  return target;
}

async function hasOtherActiveOwner(
  organizationId: string,
  excludedUserId: string,
): Promise<boolean> {
  const count = await prisma.user.count({
    where: {
      organization_id: organizationId,
      is_active: true,
      id: { not: excludedUserId },
      staffAssignments: { some: { role: { code: 'owner' } } },
    },
  });

  return count > 0;
}

export async function listStaff({
  actor,
  page,
  limit,
  status,
  roleCode,
}: ListStaffParams): Promise<{ staff: StaffMemberResponse[]; total: number }> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  const assignmentScope: Prisma.StaffAssignmentWhereInput = organizationWide
    ? {}
    : { outlet_id: { in: outletIds } };

  const where: Prisma.UserWhereInput = {
    organization_id: actor.organization_id,
    staffAssignments: {
      some: {
        ...assignmentScope,
        ...(roleCode ? { role: { code: roleCode } } : {}),
      },
    },
    ...(status === 'active' ? { is_active: true } : {}),
    ...(status === 'inactive' ? { is_active: false } : {}),
  };

  const [total, staff] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: staffInclude,
      orderBy: [{ full_name: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { staff: staff.map(toStaffResponse), total };
}

export async function changeStaffRole({
  actor,
  currentOutlet,
  staffId,
  roleCode,
}: ChangeStaffRoleParams): Promise<StaffMemberResponse> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  const target = await findStaffTarget(staffId, actor.organization_id);
  const role = await prisma.role.findUnique({ where: { code: roleCode } });

  if (!role) {
    throw new AppError('VALIDATION_ERROR', 'Unknown role', 400);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  assertCanManageTarget(organizationWide, outletIds, target);

  const actorRoleCode = await getActorRoleCode(actor.id, currentOutlet.id);

  if ((ROLE_RANK[role.code] ?? 0) > (ROLE_RANK[actorRoleCode] ?? 0)) {
    throw new AppError('FORBIDDEN', 'Cannot grant a role higher than your own', 403);
  }

  const targetIsOwner = isOwner(target);

  if (
    targetIsOwner &&
    role.code !== 'owner' &&
    target.is_active &&
    !(await hasOtherActiveOwner(actor.organization_id, target.id))
  ) {
    throw new AppError('CONFLICT', 'The last active Owner cannot be demoted', 409);
  }

  await prisma.$transaction(async (tx) => {
    // Owner is organization-wide: replace every assignment with one NULL outlet.
    if (role.code === 'owner') {
      if (targetIsOwner) {
        return;
      }

      await tx.staffAssignment.deleteMany({ where: { user_id: target.id } });
      await tx.staffAssignment.create({
        data: { user_id: target.id, role_id: role.id, outlet_id: null },
      });

      return;
    }

    // Demoting an Owner places them at the outlet the caller is working in.
    if (targetIsOwner) {
      await tx.staffAssignment.deleteMany({ where: { user_id: target.id } });
      await tx.staffAssignment.create({
        data: { user_id: target.id, role_id: role.id, outlet_id: currentOutlet.id },
      });

      return;
    }

    // Waiter and Kitchen hold exactly one outlet assignment.
    if ((role.code === 'waiter' || role.code === 'kitchen') && target.staffAssignments.length > 1) {
      await tx.staffAssignment.deleteMany({ where: { user_id: target.id } });
      await tx.staffAssignment.create({
        data: { user_id: target.id, role_id: role.id, outlet_id: currentOutlet.id },
      });

      return;
    }

    await tx.staffAssignment.updateMany({
      where: { user_id: target.id },
      data: { role_id: role.id },
    });
  });

  return toStaffResponse(await findStaffTarget(staffId, actor.organization_id));
}

export interface ChangeStaffAssignmentsParams {
  actor: StaffActor;
  staffId: string;
  outletIds: string[];
}

/**
 * Replaces the outlet assignments of a staff member. The Owner keeps its
 * organization-wide assignment and is therefore not a valid target here. Waiter
 * and Kitchen must end with exactly one assignment; a Manager may hold several.
 */
export async function changeStaffAssignments({
  actor,
  staffId,
  outletIds,
}: ChangeStaffAssignmentsParams): Promise<StaffMemberResponse> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  const target = await findStaffTarget(staffId, actor.organization_id);

  const targetIsOwner = isOwner(target);

  if (targetIsOwner) {
    throw new AppError('VALIDATION_ERROR', 'Owner assignments are organization-wide', 400);
  }

  const currentAssignment = await prisma.staffAssignment.findFirst({
    where: { user_id: target.id },
    select: { role_id: true },
  });

  if (!currentAssignment) {
    throw new AppError('NOT_FOUND', 'Staff member not found', 404);
  }

  const targetRoles = new Set(target.staffAssignments.map((assignment) => assignment.role.code));

  if ((targetRoles.has('waiter') || targetRoles.has('kitchen')) && outletIds.length !== 1) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Waiter and Kitchen must have exactly one outlet assignment',
      400,
    );
  }

  const { organizationWide, outletIds: manageableOutletIds } = await getManageableOutletIds(actor);

  const resolvedOutlets: Array<{ id: string; name: string; is_active: boolean }> = [];

  for (const outletId of outletIds) {
    const outlet = await prisma.outlet.findFirst({
      where: {
        id: outletId,
        organization_id: actor.organization_id,
        deleted_at: null,
      },
      select: { id: true, name: true, is_active: true },
    });

    if (!outlet) {
      throw new AppError('NOT_FOUND', 'Outlet not found', 404);
    }

    if (!organizationWide && !manageableOutletIds.includes(outletId)) {
      throw new AppError('FORBIDDEN', 'Permission denied for this outlet', 403);
    }

    resolvedOutlets.push(outlet);
  }

  await prisma.$transaction(async (tx) => {
    await tx.staffAssignment.deleteMany({ where: { user_id: target.id } });

    for (const outlet of resolvedOutlets) {
      await tx.staffAssignment.create({
        data: {
          user_id: target.id,
          role_id: currentAssignment.role_id,
          outlet_id: outlet.id,
        },
      });
    }
  });

  // Query without requiring assignments (Managers can temporarily have zero)
  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: staffId },
    include: staffInclude,
  });

  return toStaffResponse(updated);
}

export async function deactivateStaff({ actor, staffId }: DeactivateStaffParams): Promise<void> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  const target = await findStaffTarget(staffId, actor.organization_id);
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  assertCanManageTarget(organizationWide, outletIds, target);

  if (target.id === actor.id) {
    throw new AppError('CONFLICT', 'You cannot deactivate your own account', 409);
  }

  if (!target.is_active) {
    throw new AppError('CONFLICT', 'Staff member is already deactivated', 409);
  }

  if (isOwner(target) && !(await hasOtherActiveOwner(actor.organization_id, target.id))) {
    throw new AppError('CONFLICT', 'The last active Owner cannot be deactivated', 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { is_active: false },
    });

    await tx.refreshToken.updateMany({
      where: { user_id: target.id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  });
}
