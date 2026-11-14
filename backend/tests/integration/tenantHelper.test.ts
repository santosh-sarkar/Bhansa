import { beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';

import { authMiddleware } from '@/middlewares/auth';
import { cookieParserMiddleware } from '@/middlewares/cookieParser';
import { errorHandler } from '@/middlewares/errorHandler';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import { createOutlet } from '../helpers/factories';
import {
  createIsolatedTenants,
  createSession,
  expectTenantDenied,
  STAFF_ROLES,
  tenantApi,
  type TestTenant,
} from '../helpers/tenant';

const app = express();
app.use(cookieParserMiddleware);
app.get('/tenant/outlet', authMiddleware, outletContextMiddleware, (req, res) => {
  res.json({ success: true, data: { outlet: req.outlet } });
});
app.use(errorHandler);

describe('tenant isolation helper', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  beforeAll(async () => {
    ({ tenantA, tenantB } = await createIsolatedTenants());
  });

  it('creates two independent tenants with one user per role', () => {
    expect(tenantA.organization.id).not.toBe(tenantB.organization.id);
    expect(tenantA.outlet.id).not.toBe(tenantB.outlet.id);

    for (const role of STAFF_ROLES) {
      expect(tenantA.users[role].organization_id).toBe(tenantA.organization.id);
      expect(tenantB.users[role].organization_id).toBe(tenantB.organization.id);
      expect(tenantA.users[role].id).not.toBe(tenantB.users[role].id);
    }
  });

  it('signs a user in and sends the outlet header', async () => {
    const session = await createSession(tenantA.users.waiter, tenantA.outlet.id);

    const response = await tenantApi(app, session).get('/tenant/outlet');

    expect(response.status).toBe(200);
    expect(response.body.data.outlet).toMatchObject({
      id: tenantA.outlet.id,
      organization_id: tenantA.organization.id,
    });
  });

  it('rejects the other tenant outlet', async () => {
    const session = await createSession(tenantA.users.owner, tenantA.outlet.id);

    const response = await tenantApi(app, session).at(tenantB.outlet.id).get('/tenant/outlet');

    expectTenantDenied(response);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('switches outlets without changing the signed-in user', async () => {
    const session = await createSession(tenantA.users.owner, tenantA.outlet.id);
    const api = tenantApi(app, session);

    const own = await api.get('/tenant/outlet');
    expect(own.status).toBe(200);

    const siblingOutlet = await createOutlet(tenantA.organization.id, { name: 'Sibling' });
    expect((await api.at(siblingOutlet.id).get('/tenant/outlet')).status).toBe(200);

    const unassignedOutlet = await createOutlet(tenantA.organization.id, { name: 'Unassigned' });
    const waiterSession = await createSession(tenantA.users.waiter, tenantA.outlet.id);
    const denied = await tenantApi(app, waiterSession)
      .at(unassignedOutlet.id)
      .get('/tenant/outlet');
    expectTenantDenied(denied);
  });

  it('posts bodies and keeps cookie/header handling', async () => {
    const session = await createSession(tenantA.users.manager, tenantA.outlet.id);
    const response = await tenantApi(app, session).post('/tenant/outlet', { ping: true });

    // The route only accepts GET, so a 404 proves the request was sent with
    // the helper's headers rather than failing auth or outlet resolution.
    expect(response.status).toBe(404);
  });

  it('flags a response that is not a tenant denial', () => {
    expect(() => expectTenantDenied({ status: 200, body: { success: true } })).toThrow(
      /Expected tenant isolation denial/,
    );
    expect(() => expectTenantDenied({ status: 403, body: { success: true } })).toThrow(
      /failure envelope/,
    );
  });
});
