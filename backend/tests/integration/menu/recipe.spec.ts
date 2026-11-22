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

describe('Recipe CRUD', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;
  let categoryId: string;
  let menuItemId: string;
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

    // Create a category and menu item for testing
    const category = await prisma.menuCategory.create({
      data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
    });
    categoryId = category.id;

    const menuItem = await prisma.menuItem.create({
      data: {
        organization_id: tenantA.organization.id,
        category_id: categoryId,
        name: 'Test Menu Item',
        base_price: 100,
        is_active: true,
      },
    });
    menuItemId = menuItem.id;

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

  describe('GET /api/v1/menu/items/:menuItemId/recipe', () => {
    beforeAll(async () => {
      // Create some recipe items
      await prisma.recipeItem.createMany({
        data: [
          { menu_item_id: menuItemId, ingredient_id: ingredientId1, quantity: 0.5 },
          { menu_item_id: menuItemId, ingredient_id: ingredientId2, quantity: 0.25 },
        ],
      });
    });

    it('owner can list recipe items', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${menuItemId}/recipe`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.items[0].ingredient_name).toBe('Onions'); // alphabetical
      expect(res.body.data.items[1].ingredient_name).toBe('Tomatoes');
    });

    it('manager can list recipe items', async () => {
      const res = await managerAApi.get(`/api/v1/menu/items/${menuItemId}/recipe`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi.get(`/api/v1/menu/items/${menuItemId}/recipe`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent menu item', async () => {
      const res = await ownerAApi.get(
        '/api/v1/menu/items/00000000-0000-0000-0000-000000000000/recipe',
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('tenant isolation - cannot access other tenant menu item recipe', async () => {
      // Create a category in tenantB first
      const categoryB = await prisma.menuCategory.create({
        data: { organization_id: tenantB.organization.id, name: 'Category B', sort_order: 1 },
      });
      const otherMenuItem = await prisma.menuItem.create({
        data: {
          organization_id: tenantB.organization.id,
          category_id: categoryB.id,
          name: 'Other Tenant Item',
          base_price: 50,
        },
      });

      const res = await ownerAApi.get(`/api/v1/menu/items/${otherMenuItem.id}/recipe`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/menu/items/:menuItemId/recipe/:ingredientId', () => {
    it('owner can get recipe item details', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${menuItemId}/recipe/${ingredientId1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipeItem.menu_item_id).toBe(menuItemId);
      expect(res.body.data.recipeItem.ingredient_id).toBe(ingredientId1);
      expect(res.body.data.recipeItem.ingredient_name).toBe('Tomatoes');
      expect(res.body.data.recipeItem.ingredient_unit).toBe('kg');
      expect(res.body.data.recipeItem.quantity).toBe('0.5');
    });

    it('manager can get recipe item details', async () => {
      const res = await managerAApi.get(`/api/v1/menu/items/${menuItemId}/recipe/${ingredientId1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi.get(`/api/v1/menu/items/${menuItemId}/recipe/${ingredientId1}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent recipe item', async () => {
      const res = await ownerAApi.get(
        `/api/v1/menu/items/${menuItemId}/recipe/00000000-0000-0000-0000-000000000000`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('tenant isolation - cannot access other tenant recipe item', async () => {
      // Create a category in tenantB first
      const categoryB = await prisma.menuCategory.create({
        data: { organization_id: tenantB.organization.id, name: 'Category B', sort_order: 1 },
      });
      const otherIngredient = await prisma.ingredient.create({
        data: {
          organization_id: tenantB.organization.id,
          name: 'Other Tenant Ingredient',
          unit: 'kg',
        },
      });
      const otherMenuItem = await prisma.menuItem.create({
        data: {
          organization_id: tenantB.organization.id,
          category_id: categoryB.id,
          name: 'Other Tenant Item',
          base_price: 50,
        },
      });
      await prisma.recipeItem.create({
        data: { menu_item_id: otherMenuItem.id, ingredient_id: otherIngredient.id, quantity: 1 },
      });

      const res = await ownerAApi.get(
        `/api/v1/menu/items/${otherMenuItem.id}/recipe/${otherIngredient.id}`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/menu/items/:menuItemId/recipe', () => {
    let newIngredientId: string;

    beforeAll(async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Garlic', unit: 'kg' },
      });
      newIngredientId = ingredient.id;
    });

    it('owner can add recipe item', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: newIngredientId,
        quantity: '0.1',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipeItem.menu_item_id).toBe(menuItemId);
      expect(res.body.data.recipeItem.ingredient_id).toBe(newIngredientId);
      expect(res.body.data.recipeItem.quantity).toBe('0.1');
    });

    it('manager can add recipe item', async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Ginger', unit: 'kg' },
      });

      const res = await managerAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: ingredient.id,
        quantity: '0.05',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Pepper', unit: 'kg' },
      });

      const res = await waiterAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: ingredient.id,
        quantity: '0.1',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: newIngredientId,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent menu item', async () => {
      const res = await ownerAApi
        .post('/api/v1/menu/items/00000000-0000-0000-0000-000000000000/recipe')
        .send({
          ingredient_id: newIngredientId,
          quantity: '0.1',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: '00000000-0000-0000-0000-000000000000',
        quantity: '0.1',
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 409 for duplicate ingredient in same recipe', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: newIngredientId,
        quantity: '0.2',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('validates quantity format', async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Salt', unit: 'kg' },
      });

      const res = await ownerAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: ingredient.id,
        quantity: 'invalid',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('accepts valid quantity formats', async () => {
      const ingredient1 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Qty Test 1', unit: 'kg' },
      });
      const res1 = await ownerAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: ingredient1.id,
        quantity: '1',
      });
      expect(res1.status).toBe(201);

      const ingredient2 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Qty Test 2', unit: 'kg' },
      });
      const res2 = await ownerAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: ingredient2.id,
        quantity: '1.5',
      });
      expect(res2.status).toBe(201);

      const ingredient3 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Qty Test 3', unit: 'kg' },
      });
      const res3 = await ownerAApi.post(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        ingredient_id: ingredient3.id,
        quantity: '1.500',
      });
      expect(res3.status).toBe(201);
    });
  });

  describe('PATCH /api/v1/menu/items/:menuItemId/recipe/:ingredientId', () => {
    it('owner can update recipe item quantity', async () => {
      const res = await ownerAApi
        .patch(`/api/v1/menu/items/${menuItemId}/recipe/${ingredientId1}`)
        .send({
          quantity: '1.0',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipeItem.quantity).toBe('1');
    });

    it('manager can update recipe item', async () => {
      const res = await managerAApi
        .patch(`/api/v1/menu/items/${menuItemId}/recipe/${ingredientId2}`)
        .send({
          quantity: '0.5',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipeItem.quantity).toBe('0.5');
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi
        .patch(`/api/v1/menu/items/${menuItemId}/recipe/${ingredientId1}`)
        .send({
          quantity: '1.0',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent recipe item', async () => {
      const res = await ownerAApi
        .patch(`/api/v1/menu/items/${menuItemId}/recipe/00000000-0000-0000-0000-000000000000`)
        .send({
          quantity: '1.0',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('validates quantity format', async () => {
      const res = await ownerAApi
        .patch(`/api/v1/menu/items/${menuItemId}/recipe/${ingredientId1}`)
        .send({
          quantity: 'invalid',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/menu/items/:menuItemId/recipe/:ingredientId', () => {
    it('owner can delete recipe item', async () => {
      const res = await ownerAApi.delete(
        `/api/v1/menu/items/${menuItemId}/recipe/${ingredientId2}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipeItem.ingredient_id).toBe(ingredientId2);
    });

    it('manager can delete recipe item', async () => {
      // Add a new ingredient for manager to delete
      const ingredient = await prisma.ingredient.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Manager Delete Ingredient',
          unit: 'kg',
        },
      });
      await prisma.recipeItem.create({
        data: { menu_item_id: menuItemId, ingredient_id: ingredient.id, quantity: 1 },
      });

      const res = await managerAApi.delete(
        `/api/v1/menu/items/${menuItemId}/recipe/${ingredient.id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const ingredient = await prisma.ingredient.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Waiter Delete Ingredient',
          unit: 'kg',
        },
      });
      await prisma.recipeItem.create({
        data: { menu_item_id: menuItemId, ingredient_id: ingredient.id, quantity: 1 },
      });

      const res = await waiterAApi.delete(
        `/api/v1/menu/items/${menuItemId}/recipe/${ingredient.id}`,
      );

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent recipe item', async () => {
      const res = await ownerAApi.delete(
        `/api/v1/menu/items/${menuItemId}/recipe/00000000-0000-0000-0000-000000000000`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/menu/items/:menuItemId/recipe (bulk upsert)', () => {
    it('owner can bulk upsert recipe', async () => {
      const ingredient3 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Bulk Ingredient 1', unit: 'kg' },
      });
      const ingredient4 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Bulk Ingredient 2', unit: 'kg' },
      });

      const res = await ownerAApi.put(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        items: [
          { ingredient_id: ingredient3.id, quantity: '0.3' },
          { ingredient_id: ingredient4.id, quantity: '0.4' },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
    });

    it('manager can bulk upsert recipe', async () => {
      const ingredient5 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Manager Bulk 1', unit: 'kg' },
      });
      const ingredient6 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Manager Bulk 2', unit: 'kg' },
      });

      const res = await managerAApi.put(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        items: [
          { ingredient_id: ingredient5.id, quantity: '0.5' },
          { ingredient_id: ingredient6.id, quantity: '0.6' },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const ingredient = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Waiter Bulk', unit: 'kg' },
      });

      const res = await waiterAApi.put(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        items: [{ ingredient_id: ingredient.id, quantity: '0.1' }],
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for empty items array', async () => {
      const res = await ownerAApi.put(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        items: [],
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent menu item', async () => {
      const res = await ownerAApi
        .put('/api/v1/menu/items/00000000-0000-0000-0000-000000000000/recipe')
        .send({
          items: [{ ingredient_id: ingredientId1, quantity: '0.1' }],
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await ownerAApi.put(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        items: [{ ingredient_id: '00000000-0000-0000-0000-000000000000', quantity: '0.1' }],
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('replaces existing recipe items', async () => {
      // Add initial items
      const ingredient7 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Replace Test 1', unit: 'kg' },
      });
      const ingredient8 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'Replace Test 2', unit: 'kg' },
      });
      await prisma.recipeItem.createMany({
        data: [
          { menu_item_id: menuItemId, ingredient_id: ingredient7.id, quantity: 1 },
          { menu_item_id: menuItemId, ingredient_id: ingredient8.id, quantity: 2 },
        ],
      });

      // Verify initial count
      let res = await ownerAApi.get(`/api/v1/menu/items/${menuItemId}/recipe`);
      expect(res.body.data.items.length).toBe(4); // 2 from beforeAll + 2 new

      // Bulk upsert with different items
      const ingredient9 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'New Replace 1', unit: 'kg' },
      });
      const ingredient10 = await prisma.ingredient.create({
        data: { organization_id: tenantA.organization.id, name: 'New Replace 2', unit: 'kg' },
      });

      res = await ownerAApi.put(`/api/v1/menu/items/${menuItemId}/recipe`).send({
        items: [
          { ingredient_id: ingredient9.id, quantity: '0.1' },
          { ingredient_id: ingredient10.id, quantity: '0.2' },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2); // Only the new items
    });
  });
});
