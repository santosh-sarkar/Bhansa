import { beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import type { Express, Request } from 'express';

import { errorHandler } from '@/middlewares/errorHandler';
import { requirePermission } from '@/middlewares/permission';
import {
  createStaffAssignment,
  createTenant,
  createUser,
  createOrganization,
  createOutlet,
} from '../../helpers/factories';

type TestUser = NonNullable<Request['user']>;
type TestOutlet = NonNullable<Request['outlet']>;

const buildApp = (user?: TestUser, outlet?: TestOutlet): Express => {
  const app = express();

  app.use((req, _res, next) => {
    if (user) {
      req.user = user;
    }

    if (outlet) {
      req.outlet = outlet;
    }

    next();
  });

  app.get('/protected', requirePermission('menu.edit'), (_req, res) => {
    res.json({ success: true, data: { allowed: true } });
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

describe('requirePermission middleware', () => {
  let ownerApp: Express;
  let waiterApp: Express;

  beforeAll(async () => {
    const { owner, outlet } = await createTenant();
    const organization = await createOrganization();
    const waiterOutlet = await createOutlet(organization.id);
    const waiter = await createUser(organization.id);
    await createStaffAssignment({
      userId: waiter.id,
      roleCode: 'waiter',
      outletId: waiterOutlet.id,
    });

    ownerApp = buildApp(toTestUser(owner), outlet);
    waiterApp = buildApp(toTestUser(waiter), waiterOutlet);
  });

  it('allows a role that has the permission', async () => {
    const response = await request(ownerApp).get('/protected');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ allowed: true });
  });

  it('rejects a role that does not have the permission', async () => {
    const response = await request(waiterApp).get('/protected');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects requests without an authenticated user', async () => {
    const response = await request(buildApp()).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects requests without an outlet context', async () => {
    const { owner } = await createTenant();
    const response = await request(buildApp(toTestUser(owner))).get('/protected');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
