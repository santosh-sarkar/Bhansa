import type { InviteStatus, Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { can } from '@/services/authz/permission.service';
import { emailService } from '@/services/email/email.service';
import { getActorRoleCode, getManageableOutletIds, ROLE_RANK } from '@/services/staff/access';
import { generateSecureToken, hashToken } from '@/utils/token';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface InvitationActor {
  id: string;
  organization_id: string | null;
}

export interface ActorOutlet {
  id: string;
  organization_id: string;
}

export interface CreateInvitationParams {
  actor: InvitationActor;
  currentOutlet: ActorOutlet;
  email: string;
  roleCode: string;
  outletId?: string;
}

export interface ListInvitationsParams {
  actor: InvitationActor;
  status?: InviteStatus;
  page: number;
  limit: number;
}

const invitationInclude = {
  role: { select: { id: true, code: true, name: true } },
  outlet: { select: { id: true, name: true } },
  invitedByUser: { select: { id: true, full_name: true } },
} satisfies Prisma.InvitationInclude;

type InvitationWithRelations = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

export interface InvitationResponse {
  id: string;
  email: string;
  role: { id: number; code: string; name: string };
  outlet: { id: string; name: string } | null;
  status: InviteStatus;
  expires_at: Date;
  created_at: Date;
  invited_by: { id: string; full_name: string } | null;
}

export function toInvitationResponse(invitation: InvitationWithRelations): InvitationResponse {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    outlet: invitation.outlet,
    status: invitation.status,
    expires_at: invitation.expires_at,
    created_at: invitation.created_at,
    invited_by: invitation.invitedByUser,
  };
}

async function resolveTargetOutlet(
  actor: InvitationActor,
  currentOutlet: ActorOutlet,
  roleCode: string,
  outletId: string | undefined,
): Promise<ActorOutlet | null> {
  if (roleCode === 'owner') {
    if (outletId !== undefined) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Owner invitations are organization-wide and cannot set an outlet',
        400,
      );
    }

    return null;
  }

  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  const targetId = outletId ?? currentOutlet.id;

  if (targetId === currentOutlet.id) {
    return currentOutlet;
  }

  const target = await prisma.outlet.findFirst({
    where: {
      id: targetId,
      organization_id: actor.organization_id,
      deleted_at: null,
    },
    select: { id: true, organization_id: true },
  });

  if (!target) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  const allowed = await can(actor, target, 'staff.manage');

  if (!allowed) {
    throw new AppError('FORBIDDEN', 'Permission denied for this outlet', 403);
  }

  return target;
}

async function expirePendingInvitations(organizationId: string): Promise<void> {
  await prisma.invitation.updateMany({
    where: { organization_id: organizationId, status: 'pending', expires_at: { lte: new Date() } },
    data: { status: 'expired' },
  });
}

export async function createInvitation({
  actor,
  currentOutlet,
  email,
  roleCode,
  outletId,
}: CreateInvitationParams): Promise<InvitationResponse> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  const role = await prisma.role.findUnique({ where: { code: roleCode } });

  if (!role) {
    throw new AppError('VALIDATION_ERROR', 'Unknown role', 400);
  }

  const actorRoleCode = await getActorRoleCode(actor.id, currentOutlet.id);

  if ((ROLE_RANK[role.code] ?? 0) > (ROLE_RANK[actorRoleCode] ?? 0)) {
    throw new AppError('FORBIDDEN', 'Cannot grant a role higher than your own', 403);
  }

  const targetOutlet = await resolveTargetOutlet(actor, currentOutlet, role.code, outletId);

  const existingStaff = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingStaff) {
    throw new AppError('CONFLICT', 'An account with this email already exists', 409);
  }

  const organization = await prisma.organization.findUnique({
    where: { id: actor.organization_id },
    select: { name: true },
  });

  if (!organization) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  const inviteToken = generateSecureToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const invitation = await prisma.$transaction(async (tx) => {
    // Re-inviting replaces the previous pending link (D-048).
    await tx.invitation.updateMany({
      where: { organization_id: actor.organization_id!, email, status: 'pending' },
      data: { status: 'revoked' },
    });

    return tx.invitation.create({
      data: {
        organization_id: actor.organization_id!,
        outlet_id: targetOutlet?.id ?? null,
        role_id: role.id,
        email,
        token_hash: hashToken(inviteToken),
        expires_at: expiresAt,
        invited_by: actor.id,
      },
      include: invitationInclude,
    });
  });

  await emailService.sendInvitationEmail(
    email,
    inviteToken,
    organization.name,
    role.name,
    expiresAt,
  );

  return toInvitationResponse(invitation);
}

export async function listInvitations({
  actor,
  status,
  page,
  limit,
}: ListInvitationsParams): Promise<{ invitations: InvitationResponse[]; total: number }> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  await expirePendingInvitations(actor.organization_id);

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  const where: Prisma.InvitationWhereInput = {
    organization_id: actor.organization_id,
    ...(organizationWide ? {} : { outlet_id: { in: outletIds } }),
    ...(status ? { status } : {}),
  };

  const [total, invitations] = await prisma.$transaction([
    prisma.invitation.count({ where }),
    prisma.invitation.findMany({
      where,
      include: invitationInclude,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { invitations: invitations.map(toInvitationResponse), total };
}

export async function revokeInvitation(
  actor: InvitationActor,
  invitationId: string,
): Promise<void> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  await expirePendingInvitations(actor.organization_id);

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organization_id: actor.organization_id },
    select: { id: true, outlet_id: true, status: true },
  });

  if (!invitation) {
    throw new AppError('NOT_FOUND', 'Invitation not found', 404);
  }

  await assertCanManageInvitation(actor, invitation.outlet_id);

  if (invitation.status !== 'pending') {
    throw new AppError('CONFLICT', 'Only pending invitations can be revoked', 409);
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'revoked' },
  });
}

async function assertCanManageInvitation(
  actor: InvitationActor,
  outletId: string | null,
): Promise<void> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }

  if (outletId === null) {
    const organizationAssignment = await prisma.staffAssignment.findFirst({
      where: {
        user_id: actor.id,
        outlet_id: null,
        role: { rolePermissions: { some: { permission: { code: 'staff.manage' } } } },
      },
      select: { id: true },
    });

    if (!organizationAssignment) {
      throw new AppError('FORBIDDEN', 'Permission denied', 403);
    }

    return;
  }

  const allowed = await can(
    actor,
    { id: outletId, organization_id: actor.organization_id },
    'staff.manage',
  );

  if (!allowed) {
    throw new AppError('FORBIDDEN', 'Permission denied', 403);
  }
}
