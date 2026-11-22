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

describe('Stock Adjustment and Wastage', () => {
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

    // Create an ingredient with initial stock
    const ingredient = await prisma.ingredient.create({
      data: { organization_id: tenantA.organization.id, name: 'Adjustment Test Item', unit: 'kg' },
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
  });

  describe('POST /api/v1/inventory/outlets/:outletId/stock/adjust', () => {
    it('owner can adjust stock (positive)', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: ingredientId,
          quantity: '10',
          reason: 'Correction',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet_id).toBe(tenantA.outlet.id);
      expect(res.body.data.ingredient_id).toBe(ingredientId);
      expect(res.body.data.ingredient_name).toBe('Adjustment Test Item');
      expect(res.body.data.ingredient_unit).toBe('kg');
      expect(res.body.data.quantity_before).toBe('100.000');
      expect(res.body.data.quantity_delta).toBe('10.000');
      expect(res.body.data.quantity_after).toBe('110.000');
      expect(res.body.data.movement_id).toBeDefined();
    });

    it('owner can adjust stock (negative)', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: ingredientId,
          quantity: '-5',
          reason: 'Correction',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity_before).toBe('110.000');
      expect(res.body.data.quantity_delta).toBe('-5.000');
      expect(res.body.data.quantity_after).toBe('105.000');
    });

    it('manager can adjust stock', async () => {
      const res = await managerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: ingredientId,
          quantity: '3',
          reason: 'Manager correction',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity_delta).toBe('3.000');
    });

    it('kitchen can adjust stock', async () => {
      const res = await kitchenAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: ingredientId,
          quantity: '-2',
          reason: 'Kitchen correction',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity_delta).toBe('-2.000');
    });

    it('waiter cannot adjust stock (no inventory.adjust permission)', async () => {
      const res = await waiterAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: ingredientId,
          quantity: '5',
          reason: 'Waiter correction',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for zero quantity', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: ingredientId,
          quantity: '0',
          reason: 'Zero correction',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for adjustment that would result in negative stock', async () => {
      // Current stock is 105, try to adjust by -200
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: ingredientId,
          quantity: '-200',
          reason: 'Too much',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing required fields', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: ingredientId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent outlet', async () => {
      const res = await ownerAApi
        .post('/api/v1/inventory/outlets/00000000-0000-0000-0000-000000000000/stock/adjust')
        .send({
          ingredient_id: ingredientId,
          quantity: '10',
          reason: 'Test',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: '00000000-0000-0000-0000-000000000000',
          quantity: '10',
          reason: 'Test',
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
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: otherIngredient.id,
          quantity: '10',
          reason: 'Test',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('tenant isolation - cannot adjust at other tenant outlet', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantB.outlet.id}/stock/adjust`)
        .send({
          ingredient_id: ingredientId,
          quantity: '10',
          reason: 'Test',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/inventory/outlets/:outletId/stock/wastage', () => {
    let wastageIngredientId: string;

    beforeAll(async () => {
      // Create a separate ingredient with known stock for wastage tests
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Wastage Test Item', unit: 'kg' },
      });
      wastageIngredientId = ingredient.id;

      await prisma.outletStock.create({
        data: {
          outlet_id: tenantA.outlet.id,
          ingredient_id: wastageIngredientId,
          quantity: 105,
          low_threshold: 10,
        },
      });
    });

    it('owner can record wastage', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: wastageIngredientId,
          quantity: '5',
          reason: 'Spoiled',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet_id).toBe(tenantA.outlet.id);
      expect(res.body.data.ingredient_id).toBe(wastageIngredientId);
      expect(res.body.data.ingredient_name).toBe('Wastage Test Item');
      expect(res.body.data.ingredient_unit).toBe('kg');
      expect(res.body.data.quantity_before).toBe('105.000');
      expect(res.body.data.quantity_delta).toBe('-5.000');
      expect(res.body.data.quantity_after).toBe('100.000');
      expect(res.body.data.movement_id).toBeDefined();
    });

    it('manager can record wastage', async () => {
      const res = await managerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: wastageIngredientId,
          quantity: '3',
          reason: 'Manager wastage',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity_delta).toBe('-3.000');
    });

    it('kitchen can record wastage', async () => {
      const res = await kitchenAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: wastageIngredientId,
          quantity: '2',
          reason: 'Kitchen wastage',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity_delta).toBe('-2.000');
    });

    it('waiter cannot record wastage (no inventory.wastage permission)', async () => {
      const res = await waiterAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: wastageIngredientId,
          quantity: '5',
          reason: 'Waiter wastage',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for zero or negative quantity', async () => {
      const res1 = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: wastageIngredientId,
          quantity: '0',
          reason: 'Zero wastage',
        });
      expect(res1.status).toBe(400);

      const res2 = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: wastageIngredientId,
          quantity: '-5',
          reason: 'Negative wastage',
        });
      expect(res2.status).toBe(400);
    });

    it('returns 400 for wastage that would result in negative stock', async () => {
      // Current stock is 105, try to waste 200
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: wastageIngredientId,
          quantity: '200',
          reason: 'Too much wastage',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing required fields', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: ingredientId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent outlet', async () => {
      const res = await ownerAApi
        .post('/api/v1/inventory/outlets/00000000-0000-0000-0000-000000000000/stock/wastage')
        .send({
          ingredient_id: ingredientId,
          quantity: '10',
          reason: 'Test',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: '00000000-0000-0000-0000-000000000000',
          quantity: '10',
          reason: 'Test',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('tenant isolation - cannot record wastage at other tenant outlet', async () => {
      const res = await ownerAApi
        .post(`/api/v1/inventory/outlets/${tenantB.outlet.id}/stock/wastage`)
        .send({
          ingredient_id: ingredientId,
          quantity: '10',
          reason: 'Test',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
