import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import {
  createOrganization,
  createOutlet,
  createStaffAssignment,
  createUser,
} from '../../helpers/factories';
import {
  createIsolatedTenants,
  createSession,
  createTrialSubscription,
  expectTenantDenied,
  tenantApi,
  type TenantApi,
  type TenantSession,
  type TestTenant,
} from '../../helpers/tenant';

const app = createApp();

const uniqueEmail = (label: string) => `${label}-${randomUUID()}@example.com`;

describe('staff management', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let secondOutletId: string;
  let ownerSession: TenantSession;
  let ownerApi: TenantApi;
  let managerApi: TenantApi;
  let waiterApi: TenantApi;

  const createStaff = async (options: {
    roleCode: string;
    outletId?: string | null;
    organizationId?: string;
    fullName?: string;
    isActive?: boolean;
  }) => {
    const user = await createUser(options.organizationId ?? tenantA.organization.id, {
      email: uniqueEmail(options.roleCode),
      full_name: options.fullName ?? `Test ${options.roleCode}`,
      is_active: options.isActive ?? true,
      email_verified_at: new Date(),
    });

    await createStaffAssignment({
      userId: user.id,
      roleCode: options.roleCode,
      outletId: options.outletId === undefined ? tenantA.outlet.id : options.outletId,
    });

    return user;
  };

  beforeAll(async () => {
    ({ tenantA, tenantB } = await createIsolatedTenants());
    secondOutletId = (await createOutlet(tenantA.organization.id, { name: 'Second Branch' })).id;

    // Create trial subscriptions for both tenants
    await createTrialSubscription(tenantA.organization.id);
    await createTrialSubscription(tenantB.organization.id);

    ownerSession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    ownerApi = tenantApi(app, ownerSession);
    managerApi = tenantApi(app, await createSession(tenantA.users.manager, tenantA.outlet.id));
    waiterApi = tenantApi(app, await createSession(tenantA.users.waiter, tenantA.outlet.id));
  });

  describe('GET /api/v1/staff', () => {
    it('lets an Owner see every staff member in the organization', async () => {
      const response = await ownerApi.get('/api/v1/staff?limit=100');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta).toMatchObject({ page: 1, limit: 100 });

      const emails = response.body.data.staff.map((staff: { email: string }) => staff.email);

      for (const role of ['owner', 'manager', 'waiter', 'kitchen'] as const) {
        expect(emails).toContain(tenantA.users[role].email);
      }

      for (const role of ['owner', 'manager', 'waiter', 'kitchen'] as const) {
        expect(emails).not.toContain(tenantB.users[role].email);
      }

      const waiter = response.body.data.staff.find(
        (staff: { email: string }) => staff.email === tenantA.users.waiter.email,
      );
      expect(waiter).toMatchObject({
        is_active: true,
        assignments: [{ role: { code: 'waiter' }, outlet: { id: tenantA.outlet.id } }],
      });
    });

    it('lets a Manager see only staff assigned to their outlets', async () => {
      const secondOutletWaiter = await createStaff({
        roleCode: 'waiter',
        outletId: secondOutletId,
        fullName: 'Second Outlet Waiter',
      });

      const response = await managerApi.get('/api/v1/staff?limit=100');

      expect(response.status).toBe(200);
      const emails = response.body.data.staff.map((staff: { email: string }) => staff.email);

      expect(emails).toContain(tenantA.users.manager.email);
      expect(emails).toContain(tenantA.users.waiter.email);
      expect(emails).toContain(tenantA.users.kitchen.email);
      expect(emails).not.toContain(tenantA.users.owner.email);
      expect(emails).not.toContain(secondOutletWaiter.email);
    });

    it('includes inactive staff and filters by status and role', async () => {
      const inactive = await createStaff({ roleCode: 'kitchen', isActive: false });

      const inactiveResponse = await ownerApi.get('/api/v1/staff?status=inactive&limit=100');
      expect(inactiveResponse.status).toBe(200);
      expect(
        inactiveResponse.body.data.staff.map((staff: { email: string }) => staff.email),
      ).toContain(inactive.email);
      expect(
        inactiveResponse.body.data.staff.every((staff: { is_active: boolean }) => !staff.is_active),
      ).toBe(true);

      const waiterResponse = await ownerApi.get('/api/v1/staff?role=waiter&limit=100');
      expect(waiterResponse.status).toBe(200);
      expect(waiterResponse.body.data.staff.length).toBeGreaterThan(0);
      expect(
        waiterResponse.body.data.staff.every(
          (staff: { assignments: { role: { code: string } }[] }) =>
            staff.assignments.some((assignment) => assignment.role.code === 'waiter'),
        ),
      ).toBe(true);
    });

    it('paginates the staff list', async () => {
      const first = await ownerApi.get('/api/v1/staff?page=1&limit=1');
      const second = await ownerApi.get('/api/v1/staff?page=2&limit=1');

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.meta).toMatchObject({ page: 1, limit: 1 });
      expect(second.body.meta).toMatchObject({ page: 2, limit: 1 });
      expect(second.body.meta.total).toBe(first.body.meta.total);
      expect(first.body.data.staff).toHaveLength(1);
      expect(second.body.data.staff).toHaveLength(1);
      expect(first.body.data.staff[0].id).not.toBe(second.body.data.staff[0].id);
    });

    it('rejects staff without staff.manage', async () => {
      const response = await waiterApi.get('/api/v1/staff');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('requires the outlet header', async () => {
      const response = await request(app).get('/api/v1/staff').set('Cookie', ownerSession.cookie);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an outlet outside the caller organization', async () => {
      const response = await managerApi.at(tenantB.outlet.id).get('/api/v1/staff');

      expectTenantDenied(response);
    });

    it('rejects invalid filters and pagination', async () => {
      expect((await ownerApi.get('/api/v1/staff?status=deleted')).status).toBe(400);
      expect((await ownerApi.get('/api/v1/staff?role=cashier')).status).toBe(400);
      expect((await ownerApi.get('/api/v1/staff?page=0')).status).toBe(400);
      expect((await ownerApi.get('/api/v1/staff?limit=101')).status).toBe(400);
    });
  });

  describe('PATCH /api/v1/staff/:id/role', () => {
    it('changes the role of a single-assignment staff member', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Promoted Waiter' });

      const response = await ownerApi.patch(`/api/v1/staff/${waiter.id}/role`, {
        role: 'kitchen',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.staff).toMatchObject({
        id: waiter.id,
        assignments: [{ role: { code: 'kitchen' }, outlet: { id: tenantA.outlet.id } }],
      });
    });

    it('promotes a staff member to an organization-wide Owner', async () => {
      const kitchen = await createStaff({ roleCode: 'kitchen', fullName: 'New Owner' });

      const response = await ownerApi.patch(`/api/v1/staff/${kitchen.id}/role`, {
        role: 'owner',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.staff.assignments).toHaveLength(1);
      expect(response.body.data.staff.assignments[0]).toMatchObject({
        role: { code: 'owner' },
        outlet: null,
      });

      const assignments = await prisma.staffAssignment.findMany({
        where: { user_id: kitchen.id },
      });
      expect(assignments).toHaveLength(1);
      expect(assignments[0]!.outlet_id).toBeNull();
    });

    it('demotes an Owner to a single outlet assignment at the header outlet', async () => {
      const secondOwner = await createStaff({
        roleCode: 'owner',
        outletId: null,
        fullName: 'Second Owner',
      });

      const response = await ownerApi.patch(`/api/v1/staff/${secondOwner.id}/role`, {
        role: 'manager',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.staff.assignments).toHaveLength(1);
      expect(response.body.data.staff.assignments[0]).toMatchObject({
        role: { code: 'manager' },
        outlet: { id: tenantA.outlet.id },
      });
    });

    it('collapses a multi-outlet Manager to one outlet when moving to Waiter', async () => {
      const multiOutletManager = await createStaff({
        roleCode: 'manager',
        fullName: 'Multi Outlet Manager',
      });
      await createStaffAssignment({
        userId: multiOutletManager.id,
        roleCode: 'manager',
        outletId: secondOutletId,
      });

      const response = await ownerApi.patch(`/api/v1/staff/${multiOutletManager.id}/role`, {
        role: 'waiter',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.staff.assignments).toHaveLength(1);
      expect(response.body.data.staff.assignments[0]).toMatchObject({
        role: { code: 'waiter' },
        outlet: { id: tenantA.outlet.id },
      });
    });

    it('blocks demoting the last active Owner', async () => {
      const organization = await createOrganization();
      const outlet = await createOutlet(organization.id);
      const soleOwner = await createStaff({
        roleCode: 'owner',
        outletId: null,
        organizationId: organization.id,
        fullName: 'Sole Owner',
      });
      const soleOwnerApi = tenantApi(app, await createSession(soleOwner, outlet.id));

      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
      await prisma.subscription.create({
        data: {
          organization: { connect: { id: organization.id } },
          plan: { connect: { id: plan.id } },
          status: 'active',
          max_outlets_override: 99,
        },
      });

      const response = await soleOwnerApi.patch(`/api/v1/staff/${soleOwner.id}/role`, {
        role: 'manager',
      });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');

      const assignment = await prisma.staffAssignment.findFirstOrThrow({
        where: { user_id: soleOwner.id },
      });
      expect(assignment.outlet_id).toBeNull();
    });

    it('allows a Manager to change staff in their own outlet', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Manager Target' });

      const response = await managerApi.patch(`/api/v1/staff/${waiter.id}/role`, {
        role: 'kitchen',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.staff.assignments[0].role.code).toBe('kitchen');
    });

    it('stops a Manager from changing an Owner', async () => {
      const response = await managerApi.patch(`/api/v1/staff/${tenantA.users.owner.id}/role`, {
        role: 'manager',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('stops a Manager from changing staff in another outlet', async () => {
      const secondOutletWaiter = await createStaff({
        roleCode: 'waiter',
        outletId: secondOutletId,
        fullName: 'Outside Manager Scope',
      });

      const response = await managerApi.patch(`/api/v1/staff/${secondOutletWaiter.id}/role`, {
        role: 'kitchen',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('stops a Manager from granting the Owner role', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Rank Target' });

      const response = await managerApi.patch(`/api/v1/staff/${waiter.id}/role`, {
        role: 'owner',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('denies a Waiter without staff.manage', async () => {
      const response = await waiterApi.patch(`/api/v1/staff/${tenantA.users.manager.id}/role`, {
        role: 'waiter',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for staff in another organization or an unknown id', async () => {
      const foreign = await ownerApi.patch(`/api/v1/staff/${tenantB.users.waiter.id}/role`, {
        role: 'kitchen',
      });
      expect(foreign.status).toBe(404);
      expect(foreign.body.error.code).toBe('NOT_FOUND');

      const unknown = await ownerApi.patch(
        '/api/v1/staff/00000000-0000-4000-8000-000000000000/role',
        { role: 'kitchen' },
      );
      expect(unknown.status).toBe(404);
    });

    it('rejects an unknown role or malformed id', async () => {
      const badRole = await ownerApi.patch(`/api/v1/staff/${tenantA.users.waiter.id}/role`, {
        role: 'cashier',
      });
      expect(badRole.status).toBe(400);

      const badId = await ownerApi.patch('/api/v1/staff/not-a-uuid/role', { role: 'kitchen' });
      expect(badId.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/staff/:id/deactivate', () => {
    it('deactivates staff and revokes their refresh tokens', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Leaving Waiter' });
      const waiterSession = await createSession(waiter, tenantA.outlet.id);

      await prisma.refreshToken.create({
        data: {
          user_id: waiter.id,
          token_hash: `hash-${randomUUID()}`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const response = await ownerApi.patch(`/api/v1/staff/${waiter.id}/deactivate`);

      expect(response.status).toBe(200);
      expect(response.body.data.deactivated).toBe(true);

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: waiter.id } });
      expect(stored.is_active).toBe(false);

      const activeRefreshTokens = await prisma.refreshToken.count({
        where: { user_id: waiter.id, revoked_at: null },
      });
      expect(activeRefreshTokens).toBe(0);

      const me = await request(app).get('/api/v1/auth/me').set('Cookie', waiterSession.cookie);
      expect(me.status).toBe(401);
    });

    it('lets a Manager deactivate staff in their own outlet', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Manager Deactivates' });

      const response = await managerApi.patch(`/api/v1/staff/${waiter.id}/deactivate`);

      expect(response.status).toBe(200);
    });

    it('stops a Manager from deactivating an Owner', async () => {
      const response = await managerApi.patch(`/api/v1/staff/${tenantA.users.owner.id}/deactivate`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('stops a Manager from deactivating staff in another outlet', async () => {
      const secondOutletWaiter = await createStaff({
        roleCode: 'waiter',
        outletId: secondOutletId,
        fullName: 'Outside Deactivate Scope',
      });

      const response = await managerApi.patch(`/api/v1/staff/${secondOutletWaiter.id}/deactivate`);

      expect(response.status).toBe(403);
    });

    it('stops self-deactivation', async () => {
      const response = await ownerApi.patch(`/api/v1/staff/${tenantA.users.owner.id}/deactivate`);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('rejects an already inactive staff member', async () => {
      const inactive = await createStaff({
        roleCode: 'kitchen',
        fullName: 'Already Inactive',
        isActive: false,
      });

      const response = await ownerApi.patch(`/api/v1/staff/${inactive.id}/deactivate`);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('lets an Owner deactivate another Owner when their own account remains', async () => {
      const secondOwner = await createStaff({
        roleCode: 'owner',
        outletId: null,
        fullName: 'Deactivatable Owner',
      });

      const response = await ownerApi.patch(`/api/v1/staff/${secondOwner.id}/deactivate`);

      expect(response.status).toBe(200);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: secondOwner.id } })).is_active,
      ).toBe(false);
    });

    it('returns 404 for staff in another organization or an unknown id', async () => {
      const foreign = await ownerApi.patch(`/api/v1/staff/${tenantB.users.waiter.id}/deactivate`);
      expect(foreign.status).toBe(404);

      const unknown = await ownerApi.patch(
        '/api/v1/staff/00000000-0000-4000-8000-000000000000/deactivate',
      );
      expect(unknown.status).toBe(404);
    });

    it('denies a Waiter without staff.manage and a malformed id', async () => {
      const denied = await waiterApi.patch(`/api/v1/staff/${tenantA.users.kitchen.id}/deactivate`);
      expect(denied.status).toBe(403);

      const badId = await ownerApi.patch('/api/v1/staff/not-a-uuid/deactivate');
      expect(badId.status).toBe(400);
    });
  });

  describe('PUT /api/v1/staff/:id/assignments', () => {
    it('lets an Owner assign a Manager two outlets', async () => {
      const manager = await createStaff({
        roleCode: 'manager',
        fullName: 'Two Outlet Manager',
      });

      const response = await ownerApi.put(`/api/v1/staff/${manager.id}/assignments`, {
        outlet_ids: [tenantA.outlet.id, secondOutletId],
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.staff.assignments).toHaveLength(2);
      expect(
        response.body.data.staff.assignments.map((a: { outlet: { id: string } }) => a.outlet.id),
      ).toEqual(expect.arrayContaining([tenantA.outlet.id, secondOutletId]));
    });

    it('replaces previous assignments', async () => {
      const manager = await createStaff({
        roleCode: 'manager',
        fullName: 'Replaced Manager',
      });
      await createStaffAssignment({
        userId: manager.id,
        roleCode: 'manager',
        outletId: secondOutletId,
      });

      const assigned = await ownerApi.put(`/api/v1/staff/${manager.id}/assignments`, {
        outlet_ids: [tenantA.outlet.id],
      });
      expect(assigned.status).toBe(200);
      expect(assigned.body.data.staff.assignments).toHaveLength(1);
      expect(assigned.body.data.staff.assignments[0]).toMatchObject({
        role: { code: 'manager' },
        outlet: { id: tenantA.outlet.id },
      });

      const cleared = await ownerApi.put(`/api/v1/staff/${manager.id}/assignments`, {
        outlet_ids: [],
      });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.staff.assignments).toHaveLength(0);
    });

    it('lets a Manager assign staff within their managed outlet', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Manager Assigned Waiter' });

      const response = await managerApi.put(`/api/v1/staff/${waiter.id}/assignments`, {
        outlet_ids: [tenantA.outlet.id],
      });

      expect(response.status).toBe(200);
      expect(response.body.data.staff.assignments).toHaveLength(1);
      expect(response.body.data.staff.assignments[0]).toMatchObject({
        role: { code: 'waiter' },
        outlet: { id: tenantA.outlet.id },
      });
    });

    it('stops a Manager from assigning to an outlet they do not manage', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Escalation Waiter' });

      const response = await managerApi.put(`/api/v1/staff/${waiter.id}/assignments`, {
        outlet_ids: [secondOutletId],
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects more than one outlet for Waiter and Kitchen', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Strict Waiter' });

      const response = await ownerApi.put(`/api/v1/staff/${waiter.id}/assignments`, {
        outlet_ids: [tenantA.outlet.id, secondOutletId],
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an empty outlet list for Waiter and Kitchen', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Empty Waiter' });

      const response = await ownerApi.put(`/api/v1/staff/${waiter.id}/assignments`, {
        outlet_ids: [],
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an Owner as an assignment target', async () => {
      const response = await ownerApi.put(`/api/v1/staff/${tenantA.users.owner.id}/assignments`, {
        outlet_ids: [tenantA.outlet.id],
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for outlets outside the organization or a soft-deleted outlet', async () => {
      const waiter = await createStaff({ roleCode: 'waiter', fullName: 'Missing Outlet Waiter' });

      const foreign = await ownerApi.put(`/api/v1/staff/${waiter.id}/assignments`, {
        outlet_ids: [tenantB.outlet.id],
      });
      expect(foreign.status).toBe(404);
      expect(foreign.body.error.code).toBe('NOT_FOUND');

      const deleted = await createOutlet(tenantA.organization.id, { name: 'Deleted Branch' });
      await prisma.outlet.update({
        where: { id: deleted.id },
        data: { deleted_at: new Date() },
      });

      const deletedResponse = await ownerApi.put(`/api/v1/staff/${waiter.id}/assignments`, {
        outlet_ids: [deleted.id],
      });
      expect(deletedResponse.status).toBe(404);
    });

    it('returns 404 for staff in another organization or an unknown id', async () => {
      const foreign = await ownerApi.put(`/api/v1/staff/${tenantB.users.waiter.id}/assignments`, {
        outlet_ids: [tenantA.outlet.id],
      });
      expect(foreign.status).toBe(404);

      const unknown = await ownerApi.put(
        '/api/v1/staff/00000000-0000-4000-8000-000000000000/assignments',
        {
          outlet_ids: [tenantA.outlet.id],
        },
      );
      expect(unknown.status).toBe(404);
    });

    it('denies a Waiter without staff.manage and rejects invalid bodies', async () => {
      const denied = await waiterApi.put(`/api/v1/staff/${tenantA.users.kitchen.id}/assignments`, {
        outlet_ids: [tenantA.outlet.id],
      });
      expect(denied.status).toBe(403);

      const missingOutletIds = await ownerApi.put(
        `/api/v1/staff/${tenantA.users.waiter.id}/assignments`,
        {},
      );
      expect(missingOutletIds.status).toBe(400);

      const invalidOutletIds = await ownerApi.put(
        `/api/v1/staff/${tenantA.users.waiter.id}/assignments`,
        { outlet_ids: ['not-a-uuid'] },
      );
      expect(invalidOutletIds.status).toBe(400);

      const missingOutletIdsField = await ownerApi.put(
        `/api/v1/staff/${tenantA.users.waiter.id}/assignments`,
        { outlets: [tenantA.outlet.id] },
      );
      expect(missingOutletIdsField.status).toBe(400);
    });
  });
});
