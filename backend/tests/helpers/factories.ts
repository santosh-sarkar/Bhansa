import { randomUUID } from 'node:crypto';

import type {
  Invitation,
  InviteStatus,
  Organization,
  Outlet,
  Prisma,
  StaffAssignment,
  User,
} from '@prisma/client';

import { prisma } from '@/lib/prisma';

export function createOrganization(
  overrides: Partial<Prisma.OrganizationUncheckedCreateInput> = {},
): Promise<Organization> {
  return prisma.organization.create({
    data: {
      name: 'Test Restaurant',
      slug: `test-${randomUUID()}`,
      ...overrides,
    },
  });
}

export function createOutlet(
  organizationId: string,
  overrides: Partial<Prisma.OutletUncheckedCreateInput> = {},
): Promise<Outlet> {
  return prisma.outlet.create({
    data: {
      organization_id: organizationId,
      name: 'Main Branch',
      ...overrides,
    },
  });
}

export function createUser(
  organizationId: string | null,
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
): Promise<User> {
  return prisma.user.create({
    data: {
      organization_id: organizationId,
      email: `user-${randomUUID()}@example.com`,
      password_hash: 'not-used-in-tests',
      full_name: 'Test User',
      ...overrides,
    },
  });
}

type StaffAssignmentInput = {
  userId: string;
  roleCode: string;
  outletId?: string | null;
};

export async function createStaffAssignment({
  userId,
  roleCode,
  outletId = null,
}: StaffAssignmentInput): Promise<StaffAssignment> {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });

  return prisma.staffAssignment.create({
    data: {
      user_id: userId,
      role_id: role.id,
      outlet_id: outletId,
    },
  });
}

export async function createTenant(): Promise<{
  organization: Organization;
  outlet: Outlet;
  owner: User;
  ownerAssignment: StaffAssignment;
}> {
  const organization = await createOrganization();
  const outlet = await createOutlet(organization.id);
  const owner = await createUser(organization.id);
  const ownerAssignment = await createStaffAssignment({
    userId: owner.id,
    roleCode: 'owner',
  });

  return { organization, outlet, owner, ownerAssignment };
}

type InvitationInput = {
  organizationId: string;
  roleCode: string;
  email: string;
  outletId?: string | null;
  tokenHash?: string;
  status?: InviteStatus;
  invitedBy?: string | null;
  expiresAt?: Date;
};

export async function createInvitationRecord({
  organizationId,
  roleCode,
  email,
  outletId = null,
  tokenHash = 'test-invitation-token-hash',
  status = 'pending',
  invitedBy = null,
  expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000),
}: InvitationInput): Promise<Invitation> {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });

  return prisma.invitation.create({
    data: {
      organization_id: organizationId,
      outlet_id: outletId,
      role_id: role.id,
      email,
      token_hash: tokenHash,
      status,
      invited_by: invitedBy,
      expires_at: expiresAt,
    },
  });
}
