import { describe, expect, it } from '@jest/globals';

import { prisma } from '@/lib/prisma';
import { PERMISSIONS, PLANS, ROLES, ROLE_PERMISSION_CODES } from '../../prisma/seedData';
import { createStaffAssignment, createTenant, createUser } from '../helpers/factories';

const expectedMappings = Object.values(ROLE_PERMISSION_CODES).reduce(
  (total, codes) => total + codes.length,
  0,
);

describe('test database', () => {
  it('starts each file with the reference data seeded', async () => {
    expect(await prisma.role.count()).toBe(ROLES.length);
    expect(await prisma.permission.count()).toBe(PERMISSIONS.length);
    expect(await prisma.plan.count()).toBe(PLANS.length);
    expect(await prisma.rolePermission.count()).toBe(expectedMappings);
  });
});

describe('factories', () => {
  it('creates an organization with its outlet, owner and assignment', async () => {
    const tenant = await createTenant();

    expect(tenant.outlet.organization_id).toBe(tenant.organization.id);
    expect(tenant.owner.organization_id).toBe(tenant.organization.id);
    expect(tenant.ownerAssignment.user_id).toBe(tenant.owner.id);
    expect(tenant.ownerAssignment.outlet_id).toBeNull();

    const role = await prisma.role.findUniqueOrThrow({
      where: { id: tenant.ownerAssignment.role_id },
    });
    expect(role.code).toBe('owner');
  });

  it('creates an outlet-scoped staff assignment', async () => {
    const { organization, outlet } = await createTenant();
    const user = await createUser(organization.id);

    const assignment = await createStaffAssignment({
      userId: user.id,
      roleCode: 'waiter',
      outletId: outlet.id,
    });

    expect(assignment.user_id).toBe(user.id);
    expect(assignment.outlet_id).toBe(outlet.id);
  });
});
