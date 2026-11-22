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

describe('Outlet Stock CRUD', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;
  let ingredientId1: string;
  let ingredientId2: string;

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
    waiterASession = await createSession(tenantA.users.waiter, tenantA.outlet.id);

    ownerAApi = tenantApi(app, ownerASession);
    managerAApi = tenantApi(app, managerASession);
    waiterAApi = tenantApi(app, waiterASession);

    // Create ingredients
    const ingredient1 = await prisma.ingredient.create({
      data: { organization_id: tenantA.organization.id, name: 'Tomatoes', unit: 'kg' },
    });
    ingredientId1 = ingredient1.id;

    const ingredient2 = await prisma.ingredient.create({
      data: { organization_id: tenantA.organization.id, name: 'Onions', unit: 'kg' },
    });
    ingredientId2 = ingredient2.id;
  });

  describe('GET /api/v1/inventory/outlets/:outletId/stock', () => {
    beforeAll(async () => {
      // Create some stock records
      await prisma.outletStock.createMany({
        data: [
          {
            outlet_id: tenantA.outlet.id,
            ingredient_id: ingredientId1,
            quantity: 10,
            low_threshold: 5,
          },
          {
            outlet_id: tenantA.outlet.id,
            ingredient_id: ingredientId2,
            quantity: 2,
            low_threshold: 5,
          },
        ],
      });
    });

    it('owner can list outlet stock', async () => {
      const res = await ownerAApi.get(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.items[0].ingredient_name).toBe('Onions'); // alphabetical
      expect(res.body.data.items[1].ingredient_name).toBe('Tomatoes');
      // Onions has quantity 2, threshold 5 -> is_low = true
      const onions = res.body.data.items.find((i: any) => i.ingredient_name === 'Onions');
      expect(onions.is_low).toBe(true);
      // Tomatoes has quantity 10, threshold 5 -> is_low = false
      const tomatoes = res.body.data.items.find((i: any) => i.ingredient_name === 'Tomatoes');
      expect(tomatoes.is_low).toBe(false);
    });

    it('manager can list outlet stock', async () => {
      const res = await managerAApi.get(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('kitchen can list outlet stock (inventory.view permission)', async () => {
      const kitchenASession = await createSession(tenantA.users.kitchen, tenantA.outlet.id);
      const kitchenAApi = tenantApi(app, kitchenASession);

      const res = await kitchenAApi.get(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('supports is_low filter', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock?is_low=true`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.every((i: any) => i.is_low === true)).toBe(true);
    });

    it('supports search filter', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock?search=Tomato`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(
        res.body.data.items.every((i: any) => i.ingredient_name.toLowerCase().includes('tomato')),
      ).toBe(true);
    });

    it('returns 404 for non-existent outlet', async () => {
      const res = await ownerAApi.get(
        '/api/v1/inventory/outlets/00000000-0000-0000-0000-000000000000/stock',
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('tenant isolation - cannot access other tenant outlet stock', async () => {
      const res = await ownerAApi.get(`/api/v1/inventory/outlets/${tenantB.outlet.id}/stock`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/inventory/outlets/:outletId/stock/:ingredientId', () => {
    beforeAll(async () => {
      // Ensure stock exists
      await prisma.outletStock.upsert({
        where: {
          outlet_id_ingredient_id: { outlet_id: tenantA.outlet.id, ingredient_id: ingredientId1 },
        },
        update: { quantity: 15, low_threshold: 3 },
        create: {
          outlet_id: tenantA.outlet.id,
          ingredient_id: ingredientId1,
          quantity: 15,
          low_threshold: 3,
        },
      });
    });

    it('owner can get outlet stock detail', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/${ingredientId1}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stock.outlet_id).toBe(tenantA.outlet.id);
      expect(res.body.data.stock.ingredient_id).toBe(ingredientId1);
      expect(res.body.data.stock.ingredient_name).toBe('Tomatoes');
      expect(res.body.data.stock.ingredient_unit).toBe('kg');
      expect(res.body.data.stock.quantity).toBe('15');
      expect(res.body.data.stock.low_threshold).toBe('3');
      expect(res.body.data.stock.is_low).toBe(false);
      expect(res.body.data.stock.movements).toBeDefined();
    });

    it('manager can get outlet stock detail', async () => {
      const res = await managerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/${ingredientId1}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('kitchen can get outlet stock detail', async () => {
      const kitchenASession = await createSession(tenantA.users.kitchen, tenantA.outlet.id);
      const kitchenAApi = tenantApi(app, kitchenASession);

      const res = await kitchenAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/${ingredientId1}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for non-existent stock', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/00000000-0000-0000-0000-000000000000`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('tenant isolation - cannot access other tenant outlet stock', async () => {
      const res = await ownerAApi.get(
        `/api/v1/inventory/outlets/${tenantB.outlet.id}/stock/${ingredientId1}`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/inventory/outlets/:outletId/stock/:ingredientId (update low threshold)', () => {
    it('owner can update low threshold', async () => {
      const res = await ownerAApi
        .patch(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/${ingredientId1}`)
        .send({
          low_threshold: '10',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stock.low_threshold).toBe('10');
      // Now tomatoes has quantity 15, threshold 10 -> is_low = false
      expect(res.body.data.stock.is_low).toBe(false);
    });

    it('manager can update low threshold', async () => {
      const res = await managerAApi
        .patch(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/${ingredientId2}`)
        .send({
          low_threshold: '8',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stock.low_threshold).toBe('8');
    });

    it('rejects user without inventory.manage permission', async () => {
      const res = await waiterAApi
        .patch(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/${ingredientId1}`)
        .send({
          low_threshold: '10',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi
        .patch(
          `/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/00000000-0000-0000-0000-000000000000`,
        )
        .send({
          low_threshold: '10',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('creates stock record if not exists (upsert)', async () => {
      const newIngredient = await prisma.ingredient.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'New Ingredient For Upsert',
          unit: 'kg',
        },
      });

      const res = await ownerAApi
        .patch(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/${newIngredient.id}`)
        .send({
          low_threshold: '5',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stock.ingredient_id).toBe(newIngredient.id);
      expect(res.body.data.stock.low_threshold).toBe('5');
      expect(res.body.data.stock.quantity).toBe('0'); // default quantity
    });

    it('validates low_threshold format', async () => {
      const res = await ownerAApi
        .patch(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/${ingredientId1}`)
        .send({
          low_threshold: 'invalid',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/inventory/outlets/:outletId/stock/low-thresholds (bulk update)', () => {
    let ingredientId3: string;
    let ingredientId4: string;

    beforeAll(async () => {
      const ingredient3 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Bulk Ingredient 1', unit: 'kg' },
      });
      ingredientId3 = ingredient3.id;

      const ingredient4 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Bulk Ingredient 2', unit: 'kg' },
      });
      ingredientId4 = ingredient4.id;
    });

    it('owner can bulk update low thresholds', async () => {
      const res = await ownerAApi
        .put(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/low-thresholds`)
        .send({
          items: [
            { ingredient_id: ingredientId3, low_threshold: '7' },
            { ingredient_id: ingredientId4, low_threshold: '8' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
    });

    it('manager can bulk update low thresholds', async () => {
      const ingredient5 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Manager Bulk 1', unit: 'kg' },
      });
      const ingredient6 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Manager Bulk 2', unit: 'kg' },
      });

      const res = await managerAApi
        .put(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/low-thresholds`)
        .send({
          items: [
            { ingredient_id: ingredient5.id, low_threshold: '9' },
            { ingredient_id: ingredient6.id, low_threshold: '10' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects user without inventory.manage permission', async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Waiter Bulk', unit: 'kg' },
      });

      const res = await waiterAApi
        .put(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/low-thresholds`)
        .send({
          items: [{ ingredient_id: ingredient.id, low_threshold: '5' }],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for empty items array', async () => {
      const res = await ownerAApi
        .put(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/low-thresholds`)
        .send({
          items: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent outlet', async () => {
      const res = await ownerAApi
        .put('/api/v1/inventory/outlets/00000000-0000-0000-0000-000000000000/stock/low-thresholds')
        .send({
          items: [{ ingredient_id: ingredientId1, low_threshold: '5' }],
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi
        .put(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/low-thresholds`)
        .send({
          items: [{ ingredient_id: '00000000-0000-0000-0000-000000000000', low_threshold: '5' }],
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('updates existing and creates new', async () => {
      // Update existing threshold and create new
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Bulk Update Test', unit: 'kg' },
      });

      const res = await ownerAApi
        .put(`/api/v1/inventory/outlets/${tenantA.outlet.id}/stock/low-thresholds`)
        .send({
          items: [
            { ingredient_id: ingredientId3, low_threshold: '12' }, // Update existing
            { ingredient_id: ingredient.id, low_threshold: '6' }, // Create new
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
      const updated = res.body.data.items.find((i: any) => i.ingredient_id === ingredientId3);
      expect(updated.low_threshold).toBe('12');
    });
  });
});
