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

describe('Menu Item CRUD', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;
  let categoryId: string;

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

    // Create a category for testing
    const category = await prisma.menuCategory.create({
      data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
    });
    categoryId = category.id;
  });

  describe('GET /api/v1/menu/items', () => {
    beforeAll(async () => {
      // Create some menu items
      await prisma.menuItem.createMany({
        data: [
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Item 1',
            base_price: '100.00',
            is_active: true,
            sort_order: 1,
          },
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Item 2',
            base_price: '200.00',
            is_active: true,
            sort_order: 2,
          },
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Inactive Item',
            base_price: '50.00',
            is_active: false,
            sort_order: 3,
          },
        ],
      });
    });

    it('owner can list items', async () => {
      const res = await ownerAApi.get('/api/v1/menu/items');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.pagination.total).toBe(3);
    });

    it('manager can list items', async () => {
      const res = await managerAApi.get('/api/v1/menu/items');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi.get('/api/v1/menu/items');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('supports pagination', async () => {
      const res = await ownerAApi.get('/api/v1/menu/items?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(3);
    });

    it('supports category_id filter', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items?category_id=${categoryId}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.every((item: { category_id: string }) => item.category_id === categoryId),
      ).toBe(true);
    });

    it('supports is_active filter', async () => {
      const res = await ownerAApi.get('/api/v1/menu/items?is_active=false');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Inactive Item');
    });

    it('supports is_veg filter', async () => {
      const res = await ownerAApi.get('/api/v1/menu/items?is_veg=true');

      expect(res.status).toBe(200);
      // No veg items created, should be empty
    });

    it('supports search filter', async () => {
      const res = await ownerAApi.get('/api/v1/menu/items?search=Item 1');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Item 1');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/menu/items');

      expect(res.status).toBe(401);
    });

    it('rejects cross-tenant access', async () => {
      const ownerBSession = await createSession(tenantB.users.owner, tenantB.outlet.id);
      const ownerBApi = tenantApi(app, ownerBSession);

      await prisma.menuItem.create({
        data: {
          organization_id: tenantB.organization.id,
          category_id: categoryId,
          name: 'Tenant B Item',
          base_price: '300.00',
        },
      });

      const res = await ownerBApi.get('/api/v1/menu/items');

      expect(res.status).toBe(200);
      expect(res.body.data.every((item: { name: string }) => item.name !== 'Item 1')).toBe(true);
    });
  });

  describe('GET /api/v1/menu/items/:id', () => {
    let itemId: string;

    beforeAll(async () => {
      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Test Item',
          description: 'Test Description',
          base_price: '150.00',
          is_veg: true,
          prep_time_min: 15,
          sort_order: 5,
        },
      });
      itemId = item.id;
    });

    it('owner can get item details', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${itemId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.item.name).toBe('Test Item');
      expect(res.body.data.item.description).toBe('Test Description');
      expect(res.body.data.item.base_price).toBeDefined();
      expect(res.body.data.item.is_veg).toBe(true);
      expect(res.body.data.item.prep_time_min).toBe(15);
      expect(res.body.data.item.category).toBeDefined();
    });

    it('manager can get item details', async () => {
      const res = await managerAApi.get(`/api/v1/menu/items/${itemId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi.get(`/api/v1/menu/items/${itemId}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent item', async () => {
      const res = await ownerAApi.get('/api/v1/menu/items/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await ownerAApi.get('/api/v1/menu/items/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant access', async () => {
      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantB.organization.id,
          category_id: categoryId,
          name: 'Tenant B Item',
          base_price: '300.00',
        },
      });

      const res = await ownerAApi.get(`/api/v1/menu/items/${item.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/menu/items', () => {
    it('owner can create item', async () => {
      const res = await ownerAApi.post('/api/v1/menu/items', {
        category_id: categoryId,
        name: 'New Item',
        description: 'New Description',
        base_price: 250.0,
        is_veg: true,
        prep_time_min: 20,
        sort_order: 10,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.item.name).toBe('New Item');
      expect(res.body.data.item.description).toBe('New Description');
      expect(res.body.data.item.base_price).toBeDefined();
      expect(res.body.data.item.is_veg).toBe(true);
      expect(res.body.data.item.prep_time_min).toBe(20);
      expect(res.body.data.item.sort_order).toBe(10);
    });

    it('manager can create item', async () => {
      const res = await managerAApi.post('/api/v1/menu/items', {
        category_id: categoryId,
        name: 'Manager Item',
        base_price: 180.0,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter creating item', async () => {
      const res = await waiterAApi.post('/api/v1/menu/items', {
        category_id: categoryId,
        name: 'Waiter Item',
        base_price: 100.0,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('validates required fields', async () => {
      const res = await ownerAApi.post('/api/v1/menu/items', {
        base_price: 100.0,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates name length', async () => {
      const res = await ownerAApi.post('/api/v1/menu/items', {
        category_id: categoryId,
        name: '',
        base_price: 100.0,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const longName = 'a'.repeat(101);
      const res2 = await ownerAApi.post('/api/v1/menu/items', {
        category_id: categoryId,
        name: longName,
        base_price: 100.0,
      });
      expect(res2.status).toBe(400);
    });

    it('validates base_price is positive', async () => {
      const res = await ownerAApi.post('/api/v1/menu/items', {
        category_id: categoryId,
        name: 'Test Item',
        base_price: -10,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates category_id is valid UUID', async () => {
      const res = await ownerAApi.post('/api/v1/menu/items', {
        category_id: 'not-a-uuid',
        name: 'Test Item',
        base_price: 100.0,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent category', async () => {
      const res = await ownerAApi.post('/api/v1/menu/items', {
        category_id: '00000000-0000-0000-0000-000000000000',
        name: 'Test Item',
        base_price: 100.0,
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects duplicate name in same category', async () => {
      const res = await ownerAApi.post('/api/v1/menu/items', {
        category_id: categoryId,
        name: 'New Item',
        base_price: 200.0,
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('defaults sort_order to 0', async () => {
      const res = await ownerAApi.post('/api/v1/menu/items', {
        category_id: categoryId,
        name: 'Default Sort Item',
        base_price: 100.0,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.item.sort_order).toBe(0);
    });
  });

  describe('PATCH /api/v1/menu/items/:id', () => {
    let itemId: string;

    beforeAll(async () => {
      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Update Me',
          base_price: '100.00',
          sort_order: 1,
        },
      });
      itemId = item.id;
    });

    it('owner can update item name', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}`, {
        name: 'Updated Name',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.item.name).toBe('Updated Name');
    });

    it('owner can update category_id', async () => {
      const category2 = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Category 2', sort_order: 2 },
      });

      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}`, {
        category_id: category2.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.item.category_id).toBe(category2.id);
    });

    it('owner can update base_price', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}`, {
        base_price: 300.0,
      });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.item.base_price)).toBe(300);
    });

    it('owner can update is_veg', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}`, {
        is_veg: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.item.is_veg).toBe(false);
    });

    it('owner can update is_active', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}`, {
        is_active: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.item.is_active).toBe(false);
    });

    it('manager can update item', async () => {
      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Manager Update',
          base_price: '200.00',
        },
      });

      const res = await managerAApi.patch(`/api/v1/menu/items/${item.id}`, {
        name: 'Manager Updated',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.item.name).toBe('Manager Updated');
    });

    it('rejects waiter updating item', async () => {
      const res = await waiterAApi.patch(`/api/v1/menu/items/${itemId}`, {
        name: 'Waiter Update',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent item', async () => {
      const res = await ownerAApi.patch('/api/v1/menu/items/00000000-0000-0000-0000-000000000000', {
        name: 'Test',
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects duplicate name in same category', async () => {
      await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Existing Item',
          base_price: '150.00',
        },
      });

      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Another Item',
          base_price: '200.00',
        },
      });

      const res = await ownerAApi.patch(`/api/v1/menu/items/${item.id}`, {
        name: 'Existing Item',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/menu/items/:id', () => {
    it('owner can delete item', async () => {
      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Delete Me',
          base_price: '100.00',
        },
      });

      const res = await ownerAApi.delete(`/api/v1/menu/items/${item.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.item.is_active).toBe(false);
    });

    it('manager can delete item', async () => {
      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Manager Delete',
          base_price: '150.00',
        },
      });

      const res = await managerAApi.delete(`/api/v1/menu/items/${item.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter deleting item', async () => {
      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Waiter Delete',
          base_price: '200.00',
        },
      });

      const res = await waiterAApi.delete(`/api/v1/menu/items/${item.id}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent item', async () => {
      const res = await ownerAApi.delete('/api/v1/menu/items/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant deletion', async () => {
      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantB.organization.id,
          category_id: categoryId,
          name: 'Tenant B Item',
          base_price: '300.00',
        },
      });

      const res = await ownerAApi.delete(`/api/v1/menu/items/${item.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
