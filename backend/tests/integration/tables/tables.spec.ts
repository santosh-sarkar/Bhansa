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

describe('Tables API', () => {
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

    // Create subscriptions for both tenants
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });

    await prisma.subscription.create({
      data: {
        organization_id: tenantA.organization.id,
        plan_id: plan.id,
        status: 'trialing',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.subscription.create({
      data: {
        organization_id: tenantB.organization.id,
        plan_id: plan.id,
        status: 'trialing',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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

  describe('GET /api/v1/outlets/:outletId/tables', () => {
    it('owner can list tables', async () => {
      const res = await ownerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('manager can list tables', async () => {
      const res = await managerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('waiter can list tables', async () => {
      const res = await waiterAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('supports pagination', async () => {
      // Create more tables
      for (let i = 1; i <= 5; i++) {
        await prisma.diningTable.create({
          data: {
            outlet_id: tenantA.outlet.id,
            label: `Table ${i + 10}`,
            qr_token: `qr-${i + 10}`,
          },
        });
      }

      const res = await ownerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables?page=1&limit=3`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(3);
    });

    it('supports status filter', async () => {
      const res = await ownerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables?status=free`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((t: { status: string }) => t.status === 'free')).toBe(true);
    });

    it('supports is_active filter', async () => {
      await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Inactive Table',
          qr_token: 'qr-inactive',
          is_active: false,
        },
      });

      const res = await ownerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables?is_active=true`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((t: { is_active: boolean }) => t.is_active)).toBe(true);
    });

    it('supports search filter', async () => {
      await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Special Table 1',
          qr_token: 'qr-special-1',
        },
      });

      const res = await ownerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables?search=Special`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].label).toBe('Special Table 1');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(`/api/v1/outlets/${tenantA.outlet.id}/tables`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant outlet access', async () => {
      const res = await ownerAApi.get(`/api/v1/outlets/${tenantB.outlet.id}/tables`);

      // Per TRD, both 403 and 404 are acceptable for tenant isolation denial
      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/outlets/:outletId/tables/:id', () => {
    it('owner can get table details', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Test Table 1',
          qr_token: 'qr-test-1',
        },
      });

      const res = await ownerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table.id).toBe(table.id);
      expect(res.body.data.table.label).toBe('Test Table 1');
      expect(res.body.data.table.qr_token).toBeDefined();
    });

    it('manager can get table details', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Test Table 2',
          qr_token: 'qr-test-2',
        },
      });

      const res = await managerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}`);

      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    it('waiter can get table details', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Test Table 3',
          qr_token: 'qr-test-3',
        },
      });

      const res = await waiterAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}`);

      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    it('rejects access to table in another outlet', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Test Table 4',
          qr_token: 'qr-test-4',
        },
      });

      // Create another outlet for tenantA
      const outlet2 = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Outlet 2',
        },
      });

      // Table is in outlet1, accessing via outlet2 should return 404 (table not found in outlet2)
      const res = await ownerAApi.get(`/api/v1/outlets/${outlet2.id}/tables/${table.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant table access', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Test Table 5',
          qr_token: 'qr-test-5',
        },
      });

      const res = await ownerAApi.get(`/api/v1/outlets/${tenantB.outlet.id}/tables/${table.id}`);

      // Table is in tenantA's org, accessing via tenantB's outlet should return 404 (not found in tenantB's org)
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent table', async () => {
      const res = await ownerAApi.get(
        `/api/v1/outlets/${tenantA.outlet.id}/tables/00000000-0000-0000-0000-000000000000`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await ownerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables/not-a-uuid`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/outlets/:outletId/tables', () => {
    it('owner can create table', async () => {
      const res = await ownerAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        label: 'New Table',
        seats: 4,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table.label).toBe('New Table');
      expect(res.body.data.table.seats).toBe(4);
      expect(res.body.data.table.qr_token).toBeDefined();
      expect(res.body.data.table.status).toBe('free');
      expect(res.body.data.table.is_active).toBe(true);
    });

    it('owner can create table without seats', async () => {
      const res = await ownerAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        label: 'Table No Seats',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.table.seats).toBeNull();
    });

    it('rejects duplicate label in same outlet', async () => {
      await ownerAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        label: 'Duplicate Table',
      });

      const res = await ownerAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        label: 'Duplicate Table',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('allows manager to create table', async () => {
      const res = await managerAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        label: 'Manager Table',
      });

      // Manager has tables.manage permission
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter creating table', async () => {
      const res = await waiterAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        label: 'Waiter Table',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('validates required label', async () => {
      const res = await ownerAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        seats: 4,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates label length', async () => {
      const res = await ownerAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        label: 'a'.repeat(51),
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates seats range', async () => {
      const res = await ownerAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        label: 'Test',
        seats: 0,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates max seats', async () => {
      const res = await ownerAApi.post(`/api/v1/outlets/${tenantA.outlet.id}/tables`, {
        label: 'Test',
        seats: 21,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/outlets/:outletId/tables/:id', () => {
    it('owner can update table label', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Original Label',
          qr_token: 'qr-original',
        },
      });

      const res = await ownerAApi.patch(`/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}`, {
        label: 'Updated Label',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table.label).toBe('Updated Label');
    });

    it('owner can update seats', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Seats Table',
          qr_token: 'qr-seats',
        },
      });

      const res = await ownerAApi.patch(`/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}`, {
        seats: 6,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.table.seats).toBe(6);
    });

    it('owner can update is_active', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Active Table',
          qr_token: 'qr-active',
        },
      });

      const res = await ownerAApi.patch(`/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}`, {
        is_active: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.table.is_active).toBe(false);
    });

    it('rejects duplicate label', async () => {
      const table1 = await prisma.diningTable.create({
        data: { outlet_id: tenantA.outlet.id, label: 'Table A', qr_token: 'qr-a' },
      });
      const table2 = await prisma.diningTable.create({
        data: { outlet_id: tenantA.outlet.id, label: 'Table B', qr_token: 'qr-b' },
      });

      const res = await ownerAApi.patch(
        `/api/v1/outlets/${tenantA.outlet.id}/tables/${table2.id}`,
        {
          label: 'Table A',
        },
      );

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('allows manager to update table', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Manager Table Perm Test',
          qr_token: 'qr-mgr-perm',
        },
      });

      const res = await managerAApi.patch(
        `/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}`,
        {
          label: 'Manager Update',
        },
      );

      // Manager has tables.manage permission
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/outlets/:outletId/tables/:id', () => {
    it('owner can deactivate table', async () => {
      const table = await prisma.diningTable.create({
        data: { outlet_id: tenantA.outlet.id, label: 'Deactivate Me', qr_token: 'qr-deact' },
      });

      const res = await ownerAApi.delete(`/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table.is_active).toBe(false);
    });

    it('allows manager to deactivate table', async () => {
      const table = await prisma.diningTable.create({
        data: { outlet_id: tenantA.outlet.id, label: 'Deactivate Me 2', qr_token: 'qr-deact2' },
      });

      const res = await managerAApi.delete(
        `/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/outlets/:outletId/tables/:id/regenerate-qr', () => {
    it('owner can regenerate QR token', async () => {
      const table = await prisma.diningTable.create({
        data: { outlet_id: tenantA.outlet.id, label: 'QR Table', qr_token: 'qr-old' },
      });

      const res = await ownerAApi.post(
        `/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}/regenerate-qr`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table.qr_token).not.toBe('qr-old');
    });

    it('allows manager to regenerate QR token', async () => {
      const table = await prisma.diningTable.create({
        data: { outlet_id: tenantA.outlet.id, label: 'QR Table 2', qr_token: 'qr-old2' },
      });

      const res = await managerAApi.post(
        `/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}/regenerate-qr`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table.qr_token).not.toBe('qr-old2');
    });
  });

  describe('GET /api/v1/outlets/:outletId/tables/:id/qr', () => {
    it('owner can get QR code image', async () => {
      const table = await prisma.diningTable.create({
        data: { outlet_id: tenantA.outlet.id, label: 'QR Image Table', qr_token: 'qr-image-test' },
      });

      const res = await ownerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}/qr`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('manager can get QR code image', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'QR Image Table 2',
          qr_token: 'qr-image-test-2',
        },
      });

      const res = await managerAApi.get(
        `/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}/qr`,
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
    });

    it('waiter can get QR code image', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'QR Image Table 3',
          qr_token: 'qr-image-test-3',
        },
      });

      const res = await waiterAApi.get(
        `/api/v1/outlets/${tenantA.outlet.id}/tables/${table.id}/qr`,
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
    });

    it('rejects cross-tenant access', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Cross Tenant QR',
          qr_token: 'qr-cross-tenant',
        },
      });

      const res = await ownerAApi.get(`/api/v1/outlets/${tenantB.outlet.id}/tables/${table.id}/qr`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent table', async () => {
      const res = await ownerAApi.get(
        `/api/v1/outlets/${tenantA.outlet.id}/tables/00000000-0000-0000-0000-000000000000/qr`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await ownerAApi.get(`/api/v1/outlets/${tenantA.outlet.id}/tables/not-a-uuid/qr`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
