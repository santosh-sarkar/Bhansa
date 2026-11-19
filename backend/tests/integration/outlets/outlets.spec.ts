import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { resetDatabase } from '../../helpers/database';
import {
  createIsolatedTenants,
  createSession,
  tenantApi,
  type TestTenant,
  type TenantSession,
  type TenantApi,
} from '../../helpers/tenant';

const app = createApp();

describe('Outlets API', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;

  beforeAll(async () => {
    await resetDatabase();
    const { tenantA: a, tenantB: b } = await createIsolatedTenants();
    tenantA = a;
    tenantB = b;

    // Create subscriptions for both tenants with outlet limit override
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });

    await prisma.subscription.create({
      data: {
        organization_id: tenantA.organization.id,
        plan_id: plan.id,
        status: 'trialing',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        max_outlets_override: 10, // Allow creating more outlets for testing
      },
    });

    await prisma.subscription.create({
      data: {
        organization_id: tenantB.organization.id,
        plan_id: plan.id,
        status: 'trialing',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        max_outlets_override: 10,
      },
    });

    // Create sessions
    ownerASession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    ownerAApi = tenantApi(app, ownerASession);

    managerASession = await createSession(tenantA.users.manager, tenantA.outlet.id);
    managerAApi = tenantApi(app, managerASession);

    waiterASession = await createSession(tenantA.users.waiter, tenantA.outlet.id);
    waiterAApi = tenantApi(app, waiterASession);
  });

  describe('GET /api/v1/outlets', () => {
    it('owner sees all outlets in organization', async () => {
      // Create a second outlet for tenantA
      await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Outlet 2',
        },
      });

      const res = await ownerAApi.get('/api/v1/outlets');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it('manager sees only assigned outlets', async () => {
      const res = await managerAApi.get('/api/v1/outlets');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1); // Only the outlet they're assigned to
      expect(res.body.data[0].id).toBe(tenantA.outlet.id);
    });

    it('waiter sees only assigned outlets', async () => {
      const res = await waiterAApi.get('/api/v1/outlets');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(tenantA.outlet.id);
    });

    it('supports pagination', async () => {
      // Get initial count
      const initialRes = await ownerAApi.get('/api/v1/outlets');
      const initialCount = initialRes.body.pagination.total;

      // Create more outlets
      for (let i = 2; i <= 5; i++) {
        await prisma.outlet.create({
          data: {
            organization_id: tenantA.organization.id,
            name: `Pagination Outlet ${i}`,
          },
        });
      }

      const expectedTotal = initialCount + 4;
      const res = await ownerAApi.get('/api/v1/outlets?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(expectedTotal);
      expect(res.body.pagination.totalPages).toBe(Math.ceil(expectedTotal / 2));
    });

    it('supports is_active filter', async () => {
      // Create inactive outlet
      await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Inactive Outlet',
          is_active: false,
        },
      });

      const res = await ownerAApi.get('/api/v1/outlets?is_active=true');

      expect(res.status).toBe(200);
      expect(res.body.data.every((o: { is_active: boolean }) => o.is_active)).toBe(true);
    });

    it('supports search filter', async () => {
      // Search for the tenant's outlet name pattern
      const res = await ownerAApi.get('/api/v1/outlets?search=Alpha');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toContain('Alpha');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/outlets');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('tenant isolation - ownerA cannot see tenantB outlets', async () => {
      const ownerBSession = await createSession(tenantB.users.owner, tenantB.outlet.id);
      const ownerBApi = tenantApi(app, ownerBSession);

      await ownerBApi.post('/api/v1/outlets', { name: 'Tenant B Outlet' });

      const res = await ownerAApi.get('/api/v1/outlets');

      expect(res.status).toBe(200);
      expect(res.body.data.every((o: { name: string }) => o.name !== 'Tenant B Outlet')).toBe(true);
    });
  });

  describe('GET /api/v1/outlets/:id', () => {
    it('owner can get any outlet in their organization', async () => {
      const outlet2 = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Outlet 2',
        },
      });

      const res = await ownerAApi.get(`/api/v1/outlets/${outlet2.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.id).toBe(outlet2.id);
      expect(res.body.data.outlet.name).toBe('Outlet 2');
    });

    it('manager can get assigned outlet', async () => {
      const res = await managerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.id).toBe(tenantA.outlet.id);
    });

    it('waiter can get assigned outlet', async () => {
      const res = await waiterAApi.get(`/api/v1/outlets/${tenantA.outlet.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.id).toBe(tenantA.outlet.id);
    });

    it('rejects access to unassigned outlet', async () => {
      const outlet2 = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Outlet 2',
        },
      });

      const res = await managerAApi.get(`/api/v1/outlets/${outlet2.id}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant outlet access', async () => {
      const res = await ownerAApi.get(`/api/v1/outlets/${tenantB.outlet.id}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent outlet', async () => {
      const res = await ownerAApi.get('/api/v1/outlets/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await ownerAApi.get('/api/v1/outlets/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(`/api/v1/outlets/${tenantA.outlet.id}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/outlets', () => {
    it('owner can create outlet', async () => {
      const res = await ownerAApi.post('/api/v1/outlets', {
        name: 'New Outlet',
        address: '123 Test St',
        phone: '555-1234',
        timezone: 'America/New_York',
        tax_percent: 13.0,
        service_charge_percent: 10.0,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.name).toBe('New Outlet');
      expect(res.body.data.outlet.address).toBe('123 Test St');
      expect(res.body.data.outlet.tax_percent).toBe('13.00');
      expect(res.body.data.outlet.service_charge_percent).toBe('10.00');
    });

    it('owner can create outlet with minimal fields', async () => {
      // Use a fresh organization for this test to avoid plan limit issues from other tests
      const { tenantA: freshTenant } = await createIsolatedTenants();
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
      await prisma.subscription.create({
        data: {
          organization_id: freshTenant.organization.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          max_outlets_override: 10,
        },
      });
      const freshSession = await createSession(freshTenant.users.owner, freshTenant.outlet.id);
      const freshApi = tenantApi(app, freshSession);

      const res = await freshApi.post('/api/v1/outlets', {
        name: 'Minimal Outlet',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.outlet.name).toBe('Minimal Outlet');
      expect(res.body.data.outlet.address).toBeNull();
      expect(res.body.data.outlet.timezone).toBe('UTC');
      expect(res.body.data.outlet.tax_percent).toBe('13.00');
    });

    it('rejects manager creating outlet', async () => {
      const res = await managerAApi.post('/api/v1/outlets', {
        name: 'Manager Outlet',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects waiter creating outlet', async () => {
      const res = await waiterAApi.post('/api/v1/outlets', {
        name: 'Waiter Outlet',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('validates required name', async () => {
      const res = await ownerAApi.post('/api/v1/outlets', {
        address: '123 Test St',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates name length', async () => {
      const res = await ownerAApi.post('/api/v1/outlets', {
        name: 'a'.repeat(101),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates tax_percent range', async () => {
      const res = await ownerAApi.post('/api/v1/outlets', {
        name: 'Test',
        tax_percent: 101,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates service_charge_percent range', async () => {
      const res = await ownerAApi.post('/api/v1/outlets', {
        name: 'Test',
        service_charge_percent: -1,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects when plan max_outlets limit is reached', async () => {
      // Create a fresh org with max_outlets = 1 (single plan default)
      const { tenantA: freshTenant } = await createIsolatedTenants();
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
      await prisma.subscription.create({
        data: {
          organization_id: freshTenant.organization.id,
          plan_id: plan.id,
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          // No override, so max_outlets = 1 (single plan default)
        },
      });
      const freshSession = await createSession(freshTenant.users.owner, freshTenant.outlet.id);
      const freshApi = tenantApi(app, freshSession);

      // Try to create a second outlet - should fail with PLAN_LIMIT_REACHED
      const res = await freshApi.post('/api/v1/outlets', {
        name: 'Second Outlet',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PLAN_LIMIT_REACHED');
      expect(res.body.error.details.resource).toBe('outlet');
    });
  });

  describe('PATCH /api/v1/outlets/:id', () => {
    it('owner can update outlet', async () => {
      const res = await ownerAApi.patch(`/api/v1/outlets/${tenantA.outlet.id}`, {
        name: 'Updated Name',
        address: 'Updated Address',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.name).toBe('Updated Name');
      expect(res.body.data.outlet.address).toBe('Updated Address');
    });

    it('owner can update tax and service charge', async () => {
      const res = await ownerAApi.patch(`/api/v1/outlets/${tenantA.outlet.id}`, {
        tax_percent: 15.0,
        service_charge_percent: 12.0,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.outlet.tax_percent).toBe('15.00');
      expect(res.body.data.outlet.service_charge_percent).toBe('12.00');
    });

    it('owner can update is_active', async () => {
      const res = await ownerAApi.patch(`/api/v1/outlets/${tenantA.outlet.id}`, {
        is_active: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.outlet.is_active).toBe(false);
    });

    it('allows manager with tables.manage permission to update outlet', async () => {
      const res = await managerAApi.patch(`/api/v1/outlets/${tenantA.outlet.id}`, {
        name: 'Manager Update',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.name).toBe('Manager Update');
    });

    it('rejects cross-tenant outlet update', async () => {
      const res = await ownerAApi.patch(`/api/v1/outlets/${tenantB.outlet.id}`, {
        name: 'Cross Tenant Update',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/outlets/:id/deactivate', () => {
    it('owner can deactivate outlet', async () => {
      const res = await ownerAApi.patch(`/api/v1/outlets/${tenantA.outlet.id}/deactivate`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.is_active).toBe(false);
    });

    it('rejects manager deactivating outlet', async () => {
      const res = await managerAApi.patch(`/api/v1/outlets/${tenantA.outlet.id}/deactivate`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant deactivation', async () => {
      const res = await ownerAApi.patch(`/api/v1/outlets/${tenantB.outlet.id}/deactivate`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/outlets/me/active-outlet', () => {
    it('owner can set active outlet', async () => {
      // Create a second outlet
      const outlet2 = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Outlet 2',
        },
      });

      const res = await ownerAApi.patch('/api/v1/outlets/me/active-outlet', {
        outlet_id: outlet2.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.id).toBe(outlet2.id);
    });

    it('owner can set active outlet back to original', async () => {
      const res = await ownerAApi.patch('/api/v1/outlets/me/active-outlet', {
        outlet_id: tenantA.outlet.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.id).toBe(tenantA.outlet.id);
    });

    it('manager can set active outlet for assigned outlet', async () => {
      const res = await managerAApi.patch('/api/v1/outlets/me/active-outlet', {
        outlet_id: tenantA.outlet.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet.id).toBe(tenantA.outlet.id);
    });

    it('rejects manager setting unassigned outlet', async () => {
      // Create a second outlet that manager is not assigned to
      const outlet2 = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Outlet 2',
        },
      });

      const res = await managerAApi.patch('/api/v1/outlets/me/active-outlet', {
        outlet_id: outlet2.id,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant outlet', async () => {
      const res = await ownerAApi.patch('/api/v1/outlets/me/active-outlet', {
        outlet_id: tenantB.outlet.id,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-existent outlet', async () => {
      const res = await ownerAApi.patch('/api/v1/outlets/me/active-outlet', {
        outlet_id: '00000000-0000-0000-0000-000000000000',
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid UUID', async () => {
      const res = await ownerAApi.patch('/api/v1/outlets/me/active-outlet', {
        outlet_id: 'not-a-uuid',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).patch('/api/v1/outlets/me/active-outlet').send({
        outlet_id: tenantA.outlet.id,
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
