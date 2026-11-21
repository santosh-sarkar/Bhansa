import { beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import type { Express, Request } from 'express';

import { prisma } from '@/lib/prisma';
import { errorHandler } from '@/middlewares/errorHandler';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import {
  createOrganization,
  createOutlet,
  createStaffAssignment,
  createUser,
} from '../../helpers/factories';

type TestUser = NonNullable<Request['user']>;

const buildApp = (user?: TestUser): Express => {
  const app = express();

  app.use((req, _res, next) => {
    if (user) {
      req.user = user;
    }

    next();
  });

  app.get('/outlet', outletContextMiddleware, (req, res) => {
    res.json({ success: true, data: { outlet: req.outlet } });
  });

  app.use(errorHandler);

  return app;
};

const toTestUser = (user: {
  id: string;
  email: string;
  full_name: string;
  organization_id: string | null;
  role?: string;
  outletId?: string | null;
}): TestUser => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  organization_id: user.organization_id,
  is_super_admin: false,
  role: user.role ?? 'staff',
  outletId: user.outletId ?? null,
});

const getOutlet = (user: TestUser | undefined, outletId?: string) => {
  const call = request(buildApp(user)).get('/outlet');

  return outletId ? call.set('X-Outlet-Id', outletId) : call;
};

describe('outletContextMiddleware', () => {
  let organizationId: string;
  let outletId: string;
  let secondOutletId: string;
  let foreignOutletId: string;
  let owner: TestUser;
  let waiter: TestUser;
  let manager: TestUser;

  beforeAll(async () => {
    const organization = await createOrganization();
    organizationId = organization.id;

    const outlet = await createOutlet(organization.id);
    outletId = outlet.id;
    const secondOutlet = await createOutlet(organization.id, { name: 'Second Branch' });
    secondOutletId = secondOutlet.id;

    const foreignOrganization = await createOrganization();
    const foreignOutlet = await createOutlet(foreignOrganization.id, { name: 'Foreign Branch' });
    foreignOutletId = foreignOutlet.id;

    const ownerUser = await createUser(organization.id);
    await createStaffAssignment({ userId: ownerUser.id, roleCode: 'owner' });
    owner = toTestUser(ownerUser);

    const waiterUser = await createUser(organization.id);
    await createStaffAssignment({
      userId: waiterUser.id,
      roleCode: 'waiter',
      outletId: outlet.id,
    });
    waiter = toTestUser(waiterUser);

    const managerUser = await createUser(organization.id);
    await createStaffAssignment({
      userId: managerUser.id,
      roleCode: 'manager',
      outletId: secondOutlet.id,
    });
    manager = toTestUser(managerUser);
  });

  it('rejects a missing X-Outlet-Id header', async () => {
    const response = await getOutlet(waiter);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed X-Outlet-Id header', async () => {
    const response = await getOutlet(waiter, 'not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('attaches the outlet for an assigned staff member', async () => {
    const response = await getOutlet(waiter, outletId);

    expect(response.status).toBe(200);
    expect(response.body.data.outlet).toEqual({
      id: outletId,
      organization_id: organizationId,
      name: 'Main Branch',
      is_active: true,
      timezone: 'UTC',
    });
  });

  it('lets an Owner use any outlet in the organization', async () => {
    const response = await getOutlet(owner, secondOutletId);

    expect(response.status).toBe(200);
    expect(response.body.data.outlet.id).toBe(secondOutletId);
  });

  it('rejects an outlet in another organization even for an Owner', async () => {
    const response = await getOutlet(owner, foreignOutletId);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects an outlet the staff member is not assigned to', async () => {
    const response = await getOutlet(waiter, secondOutletId);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows a Manager only at the outlets they are assigned to', async () => {
    expect((await getOutlet(manager, secondOutletId)).status).toBe(200);

    const thirdOutlet = await createOutlet(organizationId, { name: 'Third Branch' });
    const denied = await getOutlet(manager, thirdOutlet.id);

    expect(denied.status).toBe(403);
  });

  it('resolves inactive outlets so reports still work', async () => {
    const inactive = await createOutlet(organizationId, {
      name: 'Closed Branch',
      is_active: false,
    });

    const response = await getOutlet(owner, inactive.id);

    expect(response.status).toBe(200);
    expect(response.body.data.outlet).toMatchObject({ id: inactive.id, is_active: false });
  });

  it('rejects soft-deleted outlets', async () => {
    const deleted = await createOutlet(organizationId, { name: 'Deleted Branch' });
    await prisma.outlet.update({ where: { id: deleted.id }, data: { deleted_at: new Date() } });

    const response = await getOutlet(owner, deleted.id);

    expect(response.status).toBe(403);
  });

  it('rejects a nonexistent outlet id', async () => {
    const response = await getOutlet(owner, '00000000-0000-4000-8000-000000000000');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('requires an authenticated user', async () => {
    const response = await getOutlet(undefined, outletId);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a user without an organization', async () => {
    const unaffiliated = await createUser(null);

    const response = await getOutlet(toTestUser(unaffiliated), outletId);

    expect(response.status).toBe(403);
  });
});
