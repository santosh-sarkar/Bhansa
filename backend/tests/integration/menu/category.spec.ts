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

describe('Menu Category CRUD', () => {
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

  describe('GET /api/v1/menu/categories', () => {
    it('owner can list categories', async () => {
      // Create some categories
      await prisma.menuCategory.createMany({
        data: [
          { organization_id: tenantA.organization.id, name: 'Appetizers', sort_order: 1 },
          { organization_id: tenantA.organization.id, name: 'Main Courses', sort_order: 2 },
          { organization_id: tenantA.organization.id, name: 'Desserts', sort_order: 3 },
        ],
      });

      const res = await ownerAApi.get('/api/v1/menu/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.pagination.total).toBe(3);
    });

    it('manager can list categories', async () => {
      const res = await managerAApi.get('/api/v1/menu/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi.get('/api/v1/menu/categories');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('supports pagination', async () => {
      const res = await ownerAApi.get('/api/v1/menu/categories?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(3);
    });

    it('supports is_active filter', async () => {
      await prisma.menuCategory.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Inactive Category',
          sort_order: 4,
          is_active: false,
        },
      });

      const res = await ownerAApi.get('/api/v1/menu/categories?is_active=false');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Inactive Category');
    });

    it('supports search filter', async () => {
      const res = await ownerAApi.get('/api/v1/menu/categories?search=Main');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Main Courses');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/menu/categories');

      expect(res.status).toBe(401);
    });

    it('rejects cross-tenant access', async () => {
      // Owner from tenantB should only see their own categories
      const ownerBSession = await createSession(tenantB.users.owner, tenantB.outlet.id);
      const ownerBApi = tenantApi(app, ownerBSession);

      await prisma.menuCategory.create({
        data: {
          organization_id: tenantB.organization.id,
          name: 'Tenant B Category',
          sort_order: 1,
        },
      });

      const res = await ownerBApi.get('/api/v1/menu/categories');

      expect(res.status).toBe(200);
      expect(res.body.data.every((c: { name: string }) => c.name !== 'Appetizers')).toBe(true);
    });
  });

  describe('GET /api/v1/menu/categories/:id', () => {
    let categoryId: string;

    beforeAll(async () => {
      const category = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 5 },
      });
      categoryId = category.id;
    });

    it('owner can get category details', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/categories/${categoryId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category.name).toBe('Test Category');
    });

    it('manager can get category details', async () => {
      const res = await managerAApi.get(`/api/v1/menu/categories/${categoryId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi.get(`/api/v1/menu/categories/${categoryId}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent category', async () => {
      const res = await ownerAApi.get(
        '/api/v1/menu/categories/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await ownerAApi.get('/api/v1/menu/categories/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant access', async () => {
      const category = await prisma.menuCategory.create({
        data: {
          organization_id: tenantB.organization.id,
          name: 'Tenant B Category',
          sort_order: 1,
        },
      });

      const res = await ownerAApi.get(`/api/v1/menu/categories/${category.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/menu/categories', () => {
    it('owner can create category', async () => {
      const res = await ownerAApi.post('/api/v1/menu/categories', {
        name: 'New Category',
        sort_order: 10,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category.name).toBe('New Category');
      expect(res.body.data.category.sort_order).toBe(10);
    });

    it('manager can create category', async () => {
      const res = await managerAApi.post('/api/v1/menu/categories', {
        name: 'Manager Category',
        sort_order: 20,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter creating category', async () => {
      const res = await waiterAApi.post('/api/v1/menu/categories', {
        name: 'Waiter Category',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('validates required name', async () => {
      const res = await ownerAApi.post('/api/v1/menu/categories', {
        sort_order: 5,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates name length', async () => {
      const res = await ownerAApi.post('/api/v1/menu/categories', {
        name: '',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const longName = 'a'.repeat(101);
      const res2 = await ownerAApi.post('/api/v1/menu/categories', { name: longName });
      expect(res2.status).toBe(400);
    });

    it('rejects duplicate name in same organization', async () => {
      const res = await ownerAApi.post('/api/v1/menu/categories', {
        name: 'New Category',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('defaults sort_order to 0', async () => {
      const res = await ownerAApi.post('/api/v1/menu/categories', {
        name: 'Default Sort Category',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.category.sort_order).toBe(0);
    });
  });

  describe('PATCH /api/v1/menu/categories/:id', () => {
    let categoryId: string;

    beforeAll(async () => {
      const category = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Update Me', sort_order: 1 },
      });
      categoryId = category.id;
    });

    it('owner can update category name', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/categories/${categoryId}`, {
        name: 'Updated Name',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category.name).toBe('Updated Name');
    });

    it('owner can update sort_order', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/categories/${categoryId}`, {
        sort_order: 99,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.category.sort_order).toBe(99);
    });

    it('owner can update is_active', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/categories/${categoryId}`, {
        is_active: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.category.is_active).toBe(false);
    });

    it('manager can update category', async () => {
      const category = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Manager Update', sort_order: 2 },
      });

      const res = await managerAApi.patch(`/api/v1/menu/categories/${category.id}`, {
        name: 'Manager Updated',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.category.name).toBe('Manager Updated');
    });

    it('rejects waiter updating category', async () => {
      const res = await waiterAApi.patch(`/api/v1/menu/categories/${categoryId}`, {
        name: 'Waiter Update',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent category', async () => {
      const res = await ownerAApi.patch(
        '/api/v1/menu/categories/00000000-0000-0000-0000-000000000000',
        {
          name: 'Test',
        },
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects duplicate name', async () => {
      await prisma.menuCategory.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Existing Category',
          sort_order: 5,
        },
      });

      const category = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Another Category', sort_order: 6 },
      });

      const res = await ownerAApi.patch(`/api/v1/menu/categories/${category.id}`, {
        name: 'Existing Category',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/menu/categories/:id', () => {
    it('owner can delete empty category', async () => {
      const category = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Delete Me', sort_order: 100 },
      });

      const res = await ownerAApi.delete(`/api/v1/menu/categories/${category.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category.is_active).toBe(false);
    });

    it('manager can delete empty category', async () => {
      const category = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Manager Delete', sort_order: 101 },
      });

      const res = await managerAApi.delete(`/api/v1/menu/categories/${category.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter deleting category', async () => {
      const category = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Waiter Delete', sort_order: 102 },
      });

      const res = await waiterAApi.delete(`/api/v1/menu/categories/${category.id}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects deletion of category with active menu items', async () => {
      const category = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Has Items', sort_order: 103 },
      });

      await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: category.id,
          name: 'Test Item',
          base_price: '100.00',
          is_active: true,
        },
      });

      const res = await ownerAApi.delete(`/api/v1/menu/categories/${category.id}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 404 for non-existent category', async () => {
      const res = await ownerAApi.delete(
        '/api/v1/menu/categories/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant deletion', async () => {
      const category = await prisma.menuCategory.create({
        data: {
          organization_id: tenantB.organization.id,
          name: 'Tenant B Category',
          sort_order: 1,
        },
      });

      const res = await ownerAApi.delete(`/api/v1/menu/categories/${category.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
