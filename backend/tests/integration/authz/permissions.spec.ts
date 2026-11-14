import { beforeAll, describe, expect, it } from '@jest/globals';

import type { Outlet, User } from '@prisma/client';

import { can } from '@/services/authz/permission.service';
import { PERMISSIONS, ROLES, ROLE_PERMISSION_CODES } from '../../../prisma/seedData';
import {
  createOrganization,
  createOutlet,
  createStaffAssignment,
  createTenant,
  createUser,
} from '../../helpers/factories';

let organizationId: string;
let outlet: Outlet;
let secondOutlet: Outlet;
let foreignOutlet: Outlet;
const usersByRole: Record<string, User> = {};

beforeAll(async () => {
  const organization = await createOrganization();
  organizationId = organization.id;
  outlet = await createOutlet(organization.id);
  secondOutlet = await createOutlet(organization.id, { name: 'Second Branch' });

  const foreignOrganization = await createOrganization();
  foreignOutlet = await createOutlet(foreignOrganization.id, { name: 'Foreign Branch' });

  for (const role of ROLES) {
    const user = await createUser(organization.id);
    await createStaffAssignment({ userId: user.id, roleCode: role.code, outletId: outlet.id });
    usersByRole[role.code] = user;
  }
});

describe('can() permission matrix', () => {
  for (const role of ROLES) {
    describe(`role ${role.code}`, () => {
      it.each(PERMISSIONS.map((permission) => permission.code))('%s', async (code) => {
        const expected = (ROLE_PERMISSION_CODES[role.code] ?? []).includes(code);

        await expect(can(usersByRole[role.code]!, outlet, code)).resolves.toBe(expected);
      });
    });
  }
});

describe('can() scope rules', () => {
  it('lets an Owner (null outlet assignment) use any outlet in the organization', async () => {
    const { owner, organization } = await createTenant();
    const siblingOutlet = await createOutlet(organization.id, { name: 'Sibling Branch' });

    await expect(can(owner, siblingOutlet, 'menu.edit')).resolves.toBe(true);
  });

  it('denies an outlet from another organization even for an Owner', async () => {
    const { owner, outlet: ownerOutlet } = await createTenant();

    await expect(can(owner, ownerOutlet, 'menu.edit')).resolves.toBe(true);
    await expect(can(owner, foreignOutlet, 'menu.edit')).resolves.toBe(false);
  });

  it('keeps outlet-scoped staff limited to their assigned outlets', async () => {
    const manager = usersByRole.manager!;
    const waiter = usersByRole.waiter!;

    await createStaffAssignment({
      userId: manager.id,
      roleCode: 'manager',
      outletId: secondOutlet.id,
    });

    await expect(can(manager, secondOutlet, 'menu.edit')).resolves.toBe(true);
    await expect(can(waiter, secondOutlet, 'order.create')).resolves.toBe(false);
    await expect(can(waiter, outlet, 'order.create')).resolves.toBe(true);
  });

  it('denies a user who belongs to another organization', async () => {
    const outsider = await createUser(foreignOutlet.organization_id);
    await createStaffAssignment({
      userId: outsider.id,
      roleCode: 'owner',
      outletId: foreignOutlet.id,
    });

    await expect(can(outsider, outlet, 'menu.edit')).resolves.toBe(false);
    await expect(can(outsider, foreignOutlet, 'menu.edit')).resolves.toBe(true);
  });

  it('denies unknown permission codes', async () => {
    const owner = usersByRole.owner!;

    await expect(can(owner, outlet, 'does.not.exist')).resolves.toBe(false);
  });

  it('denies a user with no staff assignment', async () => {
    const unassigned = await createUser(organizationId);
    const superAdmin = await createUser(organizationId, { is_super_admin: true });

    await expect(can(unassigned, outlet, 'menu.edit')).resolves.toBe(false);
    await expect(can(superAdmin, outlet, 'menu.edit')).resolves.toBe(false);
  });

  it('denies a user without an organization', async () => {
    const user = await createUser(null);

    await expect(can(user, outlet, 'menu.edit')).resolves.toBe(false);
  });
});
