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

describe('Restock', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let kitchenASession: TenantSession;
  let kitchenAApi: TenantApi;
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

    ownerAApi = tenantApi(app, ownerASession);
    managerAApi = tenantApi(app, managerASession);
    kitchenAApi = tenantApi(app, kitchenASession);

    // Create an ingredient
    const ingredient = await prisma.ingredient.create({
      data: { organization_id: tenantA.organization.id, name: 'Restock Test Item', unit: 'kg' },
    });
    ingredientId = ingredient.id;
  });

  describe('POST /api/v1/inventory/outlets/:outletId/stock/restock', () => {
    it('owner can restock ingredient', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '10.5',
          unit_cost: '5.00',
          supplier: 'Test Supplier',
          reason: 'Initial stock',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet_id).toBe(tenantA.outlet.id);
      expect(res.body.data.ingredient_id).toBe(ingredientId);
      expect(res.body.data.ingredient_name).toBe('Restock Test Item');
      expect(res.body.data.ingredient_unit).toBe('kg');
      expect(res.body.data.quantity_before).toBe('0.000');
      expect(res.body.data.quantity_added).toBe('10.500');
      expect(res.body.data.quantity_after).toBe('10.500');
      expect(res.body.data.movement_id).toBeDefined();
    });

    it('manager can restock ingredient', async () => {
      const res = await managerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '5',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity_before).toBe('10.500');
      expect(res.body.data.quantity_added).toBe('5.000');
      expect(res.body.data.quantity_after).toBe('15.500');
    });

    it('kitchen cannot restock (no inventory.restock permission)', async () => {
      const res = await kitchenAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '5',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('waiter cannot restock (no inventory.restock permission)', async () => {
      const waiterASession = await createSession(tenantA.users.waiter, tenantA.outlet.id);
      const waiterAApi = tenantApi(app, waiterASession);

      const res = await waiterAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '5',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for zero or negative quantity', async () => {
      const res1 = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '0',
        });
      expect(res1.status).toBe(400);

      const res2 = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '-5',
        });
      expect(res2.status).toBe(400);
    });

    it('returns 404 for non-existent outlet', async () => {
      const res = await ownerAApi
        .post('/api/v1/inventory/outlets/00000000-0000-0000-0000-000000000000/stock/restock')
        .send({
          ingredient_id: ingredientId,
          quantity: '10',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: '00000000-0000-0000-0000-000000000000',
          quantity: '10',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for ingredient from other tenant', async () => {
      const otherIngredient = await prisma.ingredient.create({
        data: { organization_id: tenantB.organization.id, name: 'Other Tenant Item', unit: 'kg' },
      });

      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: otherIngredient.id,
          quantity: '10',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('cumulative restock works correctly', async () => {
      // First restock
      const res1 = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '5',
        });
      expect(res1.status).toBe(201);
      const afterFirst = res1.body.data.quantity_after;

      // Second restock
      const res2 = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '3',
        });
      expect(res2.status).toBe(201);
      expect(res2.body.data.quantity_before).toBe(afterFirst);
      expect(res2.body.data.quantity_added).toBe('3.000');
      expect(Number(res2.body.data.quantity_after)).toBe(Number(afterFirst) + 3);
    });

    it('creates stock movement record with correct details', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '7.5',
          unit_cost: '3.25',
          supplier: 'Fresh Foods Co',
          reason: 'Weekly restock',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.movement_id).toBeDefined();

      // Verify movement record exists
      const movement = await prisma.stockMovement.findUnique({
        where: { id: res.body.data.movement_id },
      });
      expect(movement).not.toBeNull();
      expect(movement!.type).toBe('restock');
      expect(Number(movement!.quantity_delta)).toBe(7.5);
      expect(movement!.unit_cost).toBeDefined();
      expect(Number(movement!.unit_cost!)).toBe(3.25);
      expect(movement!.supplier).toBe('Fresh Foods Co');
      expect(movement!.reason).toBe('Weekly restock');
      expect(movement!.performed_by).toBe(tenantA.users.owner.id);
    });

    it('validates quantity format', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: 'invalid',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates unit_cost format', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '10',
          unit_cost: 'invalid',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('accepts valid quantity formats', async () => {
      const res1 = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '1',
        });
      expect(res1.status).toBe(201);

      const res2 = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '1.5',
        });
      expect(res2.status).toBe(201);

      const res3 = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '1.500',
        });
      expect(res3.status).toBe(201);
    });

    it('tenant isolation - cannot restock at other tenant outlet', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantB.outlet.id}/stock/restock`)
        .send({
          ingredient_id: ingredientId,
          quantity: '10',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
