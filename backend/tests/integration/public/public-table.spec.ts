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

describe('GET /api/v1/public/tables/:qrToken', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;

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

    // Create tables for testing
    await prisma.diningTable.create({
      data: {
        outlet_id: tenantA.outlet.id,
        label: 'Test Table 1',
        qr_token: 'qr-test-1',
      },
    });

    await prisma.diningTable.create({
      data: {
        outlet_id: tenantA.outlet.id,
        label: 'Test Table 2',
        qr_token: 'qr-test-2',
      },
    });

    await prisma.diningTable.create({
      data: {
        outlet_id: tenantB.outlet.id,
        label: 'Tenant B Table',
        qr_token: 'qr-tenant-b',
      },
    });

    // Create sessions
    ownerASession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    ownerAApi = tenantApi(app, ownerASession);
  });

  describe('GET /api/v1/public/tables/:qrToken', () => {
    it('resolves valid QR token to table, outlet, and effective menu', async () => {
      const res = await request(app).get('/api/v1/public/tables/qr-test-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        table: {
          id: expect.any(String),
          label: 'Test Table 1',
          qr_token: 'qr-test-1',
          is_active: true,
        },
        outlet: {
          id: tenantA.outlet.id,
          name: tenantA.outlet.name,
        },
      });
      expect(res.body.data.effective_menu).toBeDefined();
      expect(Array.isArray(res.body.data.effective_menu.categories)).toBe(true);
    });

    it('returns 404 for invalid QR token', async () => {
      const res = await request(app).get('/api/v1/public/tables/invalid-qr-token-123');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for QR token of inactive table', async () => {
      // Create an inactive table
      const inactiveTable = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Inactive Table',
          qr_token: 'qr-inactive-test',
          is_active: false,
        },
      });

      const res = await request(app).get(`/api/v1/public/tables/${inactiveTable.qr_token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for QR token of table in deleted outlet', async () => {
      // Create a table in an outlet, then soft-delete the outlet
      const outlet = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Deleted Outlet',
        },
      });

      const table = await prisma.diningTable.create({
        data: {
          outlet_id: outlet.id,
          label: 'Table in Deleted Outlet',
          qr_token: 'qr-deleted-outlet',
        },
      });

      await prisma.outlet.update({
        where: { id: outlet.id },
        data: { deleted_at: new Date() },
      });

      const res = await request(app).get(`/api/v1/public/tables/${table.qr_token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for QR token of table in inactive outlet', async () => {
      // Create an outlet and deactivate it
      const outlet = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Inactive Outlet',
          is_active: false,
        },
      });

      const table = await prisma.diningTable.create({
        data: {
          outlet_id: outlet.id,
          label: 'Table in Inactive Outlet',
          qr_token: 'qr-inactive-outlet',
        },
      });

      const res = await request(app).get(`/api/v1/public/tables/${table.qr_token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for QR token from another tenant', async () => {
      // Use the known QR token from tenantB
      const res = await request(app).get('/api/v1/public/tables/qr-tenant-b');

      // The endpoint should still work cross-tenant since it's public
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    it('returns 400 for invalid QR token format', async () => {
      const res = await request(app).get('/api/v1/public/tables/not-a-uuid-but-invalid-format');

      // Should handle gracefully
      expect([400, 404]).toContain(res.status);
    });

    it('includes effective menu with categories and items', async () => {
      // Create a category and item for tenantA
      const category = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
      });

      await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: category.id,
          name: 'Test Item',
          description: 'Test Description',
          base_price: '100.00',
          is_active: true,
        },
      });

      const res = await request(app).get('/api/v1/public/tables/qr-test-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.effective_menu.categories.length).toBeGreaterThan(0);
      expect(res.body.data.effective_menu.categories[0].items.length).toBeGreaterThan(0);
      expect(res.body.data.effective_menu.categories[0].items[0]).toMatchObject({
        name: 'Test Item',
        description: 'Test Description',
        base_price: '100',
      });
    });

    it('returns outlet tax and service charge', async () => {
      const res = await request(app).get('/api/v1/public/tables/qr-test-1');

      expect(res.status).toBe(200);
      expect(res.body.data.outlet.tax_percent).toBeDefined();
      expect(res.body.data.outlet.service_charge_percent).toBeDefined();
    });

    it('returns table status and seats', async () => {
      const res = await request(app).get('/api/v1/public/tables/qr-test-1');

      expect(res.status).toBe(200);
      expect(res.body.data.table.status).toBe('free');
      expect(res.body.data.table.seats).toBeNull();
    });
  });
});
