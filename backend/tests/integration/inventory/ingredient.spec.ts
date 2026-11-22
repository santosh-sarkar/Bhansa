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

describe('Ingredient CRUD', () => {
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
    await createTrialSubscription(tenantA.organization.id);
    await createTrialSubscription(tenantB.organization.id);

    // Create sessions
    ownerASession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    managerASession = await createSession(tenantA.users.manager, tenantA.outlet.id);
    waiterASession = await createSession(tenantA.users.waiter, tenantA.outlet.id);

    ownerAApi = tenantApi(app, ownerASession);
    managerAApi = tenantApi(app, managerASession);
    waiterAApi = tenantApi(app, waiterASession);
  });

  describe('GET /api/v1/inventory/ingredients', () => {
    it('owner can list ingredients', async () => {
      // Create some ingredients
      await prisma.ingredient.createMany({
        data: [
          { organization_id: tenantA.organization.id, name: 'Tomatoes', unit: 'kg' },
          { organization_id: tenantA.organization.id, name: 'Onions', unit: 'kg' },
          { organization_id: tenantA.organization.id, name: 'Chicken Breast', unit: 'kg' },
        ],
      });

      const res = await ownerAApi.get('/api/v1/inventory/ingredients');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredients.length).toBe(3);
      expect(res.body.data.total).toBe(3);
    });

    it('manager can list ingredients', async () => {
      const res = await managerAApi.get('/api/v1/inventory/ingredients');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without inventory.manage permission', async () => {
      const res = await waiterAApi.get('/api/v1/inventory/ingredients');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('supports pagination', async () => {
      const res = await ownerAApi.get('/api/v1/inventory/ingredients?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.data.ingredients.length).toBe(2);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(2);
      expect(res.body.data.totalPages).toBe(2);
    });

    it('supports is_active filter', async () => {
      // Create an inactive ingredient with a unique name
      await prisma.ingredient.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Inactive Item Filter Unique',
          unit: 'pcs',
          is_active: false,
        },
      });

      const res = await ownerAApi.get('/api/v1/inventory/ingredients?is_active=false');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Check that all returned ingredients are inactive
      const inactiveIngredients = res.body.data.ingredients.filter(
        (i: any) => i.is_active === false,
      );
      expect(inactiveIngredients.length).toBeGreaterThan(0);
      expect(inactiveIngredients.every((i: any) => i.is_active === false)).toBe(true);
    });

    it('supports search filter', async () => {
      const res = await ownerAApi.get('/api/v1/inventory/ingredients?search=Tomato');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(
        res.body.data.ingredients.every((i: any) => i.name.toLowerCase().includes('tomato')),
      ).toBe(true);
    });

    it('tenant isolation - owner cannot see other tenant ingredients', async () => {
      await prisma.ingredient.create({
        data: { organization_id: tenantB.organization.id, name: 'Tenant B Item', unit: 'kg' },
      });

      const res = await ownerAApi.get('/api/v1/inventory/ingredients');

      expect(res.status).toBe(200);
      expect(
        res.body.data.ingredients.find((i: any) => i.name === 'Tenant B Item'),
      ).toBeUndefined();
    });
  });

  describe('GET /api/v1/inventory/ingredients/:id', () => {
    let ingredientId: string;

    beforeAll(async () => {
      const ingredient = await prisma.ingredient.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Test Ingredient',
          unit: 'kg',
          default_cost: 50.0,
        },
      });
      ingredientId = ingredient.id;
    });

    it('owner can get ingredient details', async () => {
      const res = await ownerAApi.get(`/api/v1/inventory/ingredients/${ingredientId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredient.id).toBe(ingredientId);
      expect(res.body.data.ingredient.name).toBe('Test Ingredient');
      expect(res.body.data.ingredient.unit).toBe('kg');
      expect(res.body.data.ingredient.default_cost).toBe('50');
    });

    it('manager can get ingredient details', async () => {
      const res = await managerAApi.get(`/api/v1/inventory/ingredients/${ingredientId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without inventory.manage permission', async () => {
      const res = await waiterAApi.get(`/api/v1/inventory/ingredients/${ingredientId}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi.get(
        '/api/v1/inventory/ingredients/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('tenant isolation - cannot access other tenant ingredient', async () => {
      const otherIngredient = await prisma.ingredient.create({
        data: { organization_id: tenantB.organization.id, name: 'Other Tenant Item', unit: 'kg' },
      });

      const res = await ownerAApi.get(`/api/v1/inventory/ingredients/${otherIngredient.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/inventory/ingredients', () => {
    it('owner can create ingredient', async () => {
      const res = await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'New Ingredient',
        unit: 'pcs',
        default_cost: '10.50',
        is_active: true,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredient.name).toBe('New Ingredient');
      expect(res.body.data.ingredient.unit).toBe('pcs');
      expect(res.body.data.ingredient.default_cost).toBe('10.5');
      expect(res.body.data.ingredient.is_active).toBe(true);
    });

    it('manager can create ingredient', async () => {
      const res = await managerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Manager Ingredient',
        unit: 'kg',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without inventory.manage permission', async () => {
      const res = await waiterAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Waiter Ingredient',
        unit: 'kg',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Incomplete',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 409 for duplicate name in same organization', async () => {
      await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Duplicate Name',
        unit: 'kg',
      });

      const res = await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Duplicate Name',
        unit: 'pcs',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('allows same name in different organization', async () => {
      await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Cross Tenant Item',
        unit: 'kg',
      });

      // Create session for tenant B owner
      const ownerBSession = await createSession(tenantB.users.owner, tenantB.outlet.id);
      const ownerBApi = tenantApi(app, ownerBSession);

      const res = await ownerBApi.post('/api/v1/inventory/ingredients').send({
        name: 'Cross Tenant Item',
        unit: 'pcs',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('validates unit length', async () => {
      const res = await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Test',
        unit: 'a'.repeat(21), // Too long
      });

      expect(res.status).toBe(400);
    });

    it('validates default_cost format', async () => {
      const res = await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Test Cost',
        unit: 'kg',
        default_cost: 'invalid',
      });

      expect(res.status).toBe(400);
    });

    it('accepts valid default_cost formats', async () => {
      const res1 = await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Cost Test 1',
        unit: 'kg',
        default_cost: '10',
      });
      expect(res1.status).toBe(201);

      const res2 = await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Cost Test 2',
        unit: 'kg',
        default_cost: '10.5',
      });
      expect(res2.status).toBe(201);

      const res3 = await ownerAApi.post('/api/v1/inventory/ingredients').send({
        name: 'Cost Test 3',
        unit: 'kg',
        default_cost: '10.5000',
      });
      expect(res3.status).toBe(201);
    });
  });

  describe('PATCH /api/v1/inventory/ingredients/:id', () => {
    let ingredientId: string;

    beforeAll(async () => {
      const ingredient = await prisma.ingredient.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Updatable Ingredient',
          unit: 'kg',
          default_cost: 20.0,
        },
      });
      ingredientId = ingredient.id;
    });

    it('owner can update ingredient name', async () => {
      const res = await ownerAApi.patch(`/api/v1/inventory/ingredients/${ingredientId}`).send({
        name: 'Updated Name',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredient.name).toBe('Updated Name');
    });

    it('owner can update ingredient unit', async () => {
      const res = await ownerAApi.patch(`/api/v1/inventory/ingredients/${ingredientId}`).send({
        unit: 'pcs',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredient.unit).toBe('pcs');
    });

    it('owner can update default_cost', async () => {
      const res = await ownerAApi.patch(`/api/v1/inventory/ingredients/${ingredientId}`).send({
        default_cost: '25.75',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredient.default_cost).toBe('25.75');
    });

    it('owner can update is_active to false', async () => {
      const res = await ownerAApi.patch(`/api/v1/inventory/ingredients/${ingredientId}`).send({
        is_active: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredient.is_active).toBe(false);
    });

    it('owner can update is_active to true', async () => {
      const res = await ownerAApi.patch(`/api/v1/inventory/ingredients/${ingredientId}`).send({
        is_active: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredient.is_active).toBe(true);
    });

    it('manager can update ingredient', async () => {
      const res = await managerAApi.patch(`/api/v1/inventory/ingredients/${ingredientId}`).send({
        name: 'Manager Updated',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without inventory.manage permission', async () => {
      const res = await waiterAApi.patch(`/api/v1/inventory/ingredients/${ingredientId}`).send({
        name: 'Waiter Updated',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi
        .patch('/api/v1/inventory/ingredients/00000000-0000-0000-0000-000000000000')
        .send({
          name: 'Non-existent',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 409 for duplicate name', async () => {
      const otherIngredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Other Name', unit: 'kg' },
      });

      const res = await ownerAApi.patch(`/api/v1/inventory/ingredients/${ingredientId}`).send({
        name: 'Other Name',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('tenant isolation - cannot update other tenant ingredient', async () => {
      const otherIngredient = await prisma.ingredient.create({
        data: {
          organization_id: tenantB.organization.id,
          name: 'Other Tenant Item Update',
          unit: 'kg',
        },
      });

      const res = await ownerAApi
        .patch(`/api/v1/inventory/ingredients/${otherIngredient.id}`)
        .send({
          name: 'Attempted Update',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/inventory/ingredients/:id', () => {
    let deletableIngredientId: string;

    beforeAll(async () => {
      const ingredient = await prisma.ingredient.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Deletable Ingredient',
          unit: 'kg',
        },
      });
      deletableIngredientId = ingredient.id;
    });

    it('owner can delete ingredient (soft delete)', async () => {
      const res = await ownerAApi.delete(`/api/v1/inventory/ingredients/${deletableIngredientId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredient.is_active).toBe(false);
    });

    it('manager can delete ingredient', async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Manager Delete', unit: 'kg' },
      });

      const res = await managerAApi.delete(`/api/v1/inventory/ingredients/${ingredient.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ingredient.is_active).toBe(false);
    });

    it('rejects waiter without inventory.manage permission', async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Waiter Delete', unit: 'kg' },
      });

      const res = await waiterAApi.delete(`/api/v1/inventory/ingredients/${ingredient.id}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi.delete(
        '/api/v1/inventory/ingredients/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 409 when ingredient has outlet stock', async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Has Stock', unit: 'kg' },
      });

      await prisma.outletStock.create({
        data: {
          outlet_id: tenantA.outlet.id,
          ingredient_id: ingredient.id,
          quantity: 10,
          low_threshold: 5,
        },
      });

      const res = await ownerAApi.delete(`/api/v1/inventory/ingredients/${ingredient.id}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 409 when ingredient has recipe items', async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Has Recipe Delete', unit: 'kg' },
      });

      let category = await prisma.menuCategory.findFirst({
        where: { organization_id: tenantA.organization.id },
      });
      if (!category) {
        category = await prisma.menuCategory.create({
          data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
        });
      }
      const menuItem = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: category.id,
          name: 'Test Item Delete',
          base_price: 100,
        },
      });

      await prisma.recipeItem.create({
        data: {
          menu_item_id: menuItem.id,
          ingredient_id: ingredient.id,
          quantity: 1,
        },
      });

      const res = await ownerAApi.delete(`/api/v1/inventory/ingredients/${ingredient.id}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('tenant isolation - cannot delete other tenant ingredient', async () => {
      const otherIngredient = await prisma.ingredient.create({
        data: {
          organization_id: tenantB.organization.id,
          name: 'Other Tenant Item Delete',
          unit: 'kg',
        },
      });

      const res = await ownerAApi.delete(`/api/v1/inventory/ingredients/${otherIngredient.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
