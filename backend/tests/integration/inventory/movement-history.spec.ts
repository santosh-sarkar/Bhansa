import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { resetDatabase } from '../../helpers/database';
import {
  createIsolatedTenants,
  createSession,
  createTrialSubscription,
  tenantApi,
  type TestTenant,
  type TenantSession,
  type TenantApi,
} from '../../helpers/tenant';

const app = createApp();

describe('Stock Movement History', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let kitchenASession: TenantSession;
  let kitchenAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;
  let ingredientId: string;

  beforeAll(async () => {
    await resetDatabase();
    const { tenantA: a, tenantB: b } = await createIsolatedTenants();
    tenantA = a;
    tenantB = b;

    // Create subscriptions for both tenants
    await createTrialSubscription(tenantA.organization.id);
    await createTrialSubscription(tenantB.organization.id);

    // Create sessions
    ownerASession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    managerASession = await createSession(tenantA.users.manager, tenantA.outlet.id);
    kitchenASession = await createSession(tenantA.users.kitchen, tenantA.outlet.id);
    waiterASession = await createSession(tenantA.users.waiter, tenantA.outlet.id);

    ownerAApi = tenantApi(app, ownerASession);
    managerAApi = tenantApi(app, managerASession);
    kitchenAApi = tenantApi(app, kitchenASession);
    waiterAApi = tenantApi(app, waiterASession);

    // Create an ingredient and some stock movements
    const ingredient = await prisma.ingredient.create({
      data: { organization_id: tenantA.organization.id, name: 'History Test Item', unit: 'kg' },
    });
    ingredientId = ingredient.id;

    // Add initial stock
    await prisma.outletStock.create({
      data: {
        outlet_id: tenantA.outlet.id,
        ingredient_id: ingredientId,
        quantity: 100,
        low_threshold: 10,
      },
    });

    // Create some movements
    await prisma.stockMovement.createMany({
      data: [
        {
          outlet_id: tenantA.outlet.id,
          ingredient_id: ingredientId,
          type: 'restock',
          quantity_delta: 50,
          balance_after: 150,
          reason: 'Initial restock',
          performed_by: tenantA.users.owner.id,
        },
        {
          outlet_id: tenantA.outlet.id,
          ingredient_id: ingredientId,
          type: 'order_deduction',
          quantity_delta: -20,
          balance_after: 130,
          reason: 'Order deduction',
          performed_by: tenantA.users.owner.id,
        },
        {
          outlet_id: tenantA.outlet.id,
          ingredient_id: ingredientId,
          type: 'adjustment',
          quantity_delta: 5,
          balance_after: 135,
          reason: 'Correction',
          performed_by: tenantA.users.owner.id,
        },
        {
          outlet_id: tenantA.outlet.id,
          ingredient_id: ingredientId,
          type: 'wastage',
          quantity_delta: -10,
          balance_after: 125,
          reason: 'Spoiled',
          performed_by: tenantA.users.owner.id,
        },
      ],
    });
  });

  describe('GET /api/v1/inventory/outlets/:outletId/stock/movements', () => {
    it('owner can list stock movements', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);
      expect(res.body.pagination.total).toBe(4);
    });

    it('manager can list stock movements', async () => {
      const res = await managerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('kitchen can list stock movements', async () => {
      const res = await kitchenAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('waiter cannot list stock movements (no inventory.view permission)', async () => {
      const res = await waiterAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements`,
      );

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('supports pagination', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements?page=1&limit=2`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('filters by ingredient_id', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements?ingredient_id=${ingredientId}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.every((m: any) => m.ingredient_id === ingredientId)).toBe(true);
    });

    it('filters by type (restock)', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements?type=restock`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.every((m: any) => m.type === 'restock')).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('filters by type (wastage)', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements?type=wastage`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.every((m: any) => m.type === 'wastage')).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('filters by date range', async () => {
      const today = new Date().toISOString();
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements?start_date=${today}&end_date=${today}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for non-existent outlet', async () => {
      const res = await ownerAApi.get(
        '/api/v1/inventory/outlets/00000000-0000-0000-0000-000000000000/stock/movements',
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('tenant isolation - cannot access other tenant outlet movements', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantB.outlet.id}/stock/movements`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns movements ordered by created_at desc', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/movements`,
      );

      expect(res.status).toBe(200);
      const dates = res.body.data.map((m: any) => new Date(m.created_at).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });
  });
});
