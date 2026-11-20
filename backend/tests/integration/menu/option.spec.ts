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

describe('Menu Item Options CRUD', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;
  let categoryId: string;
  let itemId: string;

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

    // Create a category and item for testing
    const category = await prisma.menuCategory.create({
      data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
    });
    categoryId = category.id;

    const item = await prisma.menuItem.create({
      data: {
        organization_id: tenantA.organization.id,
        category_id: categoryId,
        name: 'Test Item',
        base_price: '100.00',
        is_active: true,
      },
    });
    itemId = item.id;
  });

  describe('GET /api/v1/menu/items/:menuItemId/options', () => {
    beforeAll(async () => {
      // Create some options
      await prisma.menuItemOption.createMany({
        data: [
          {
            menu_item_id: itemId,
            kind: 'variant',
            name: 'Small',
            price_delta: '0.00',
            is_active: true,
          },
          {
            menu_item_id: itemId,
            kind: 'variant',
            name: 'Large',
            price_delta: '50.00',
            is_active: true,
          },
          {
            menu_item_id: itemId,
            kind: 'addon',
            name: 'Extra Cheese',
            price_delta: '20.00',
            is_active: true,
          },
          {
            menu_item_id: itemId,
            kind: 'addon',
            name: 'Inactive Addon',
            price_delta: '10.00',
            is_active: false,
          },
        ],
      });
    });

    it('owner can list options', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${itemId}/options`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);
      expect(res.body.pagination.total).toBe(4);
    });

    it('manager can list options', async () => {
      const res = await managerAApi.get(`/api/v1/menu/items/${itemId}/options`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi.get(`/api/v1/menu/items/${itemId}/options`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('supports pagination', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${itemId}/options?page=1&limit=2`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBe(4);
    });

    it('supports kind filter', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${itemId}/options?kind=variant`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.every((opt: { kind: string }) => opt.kind === 'variant')).toBe(true);
    });

    it('supports is_active filter', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${itemId}/options?is_active=false`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Inactive Addon');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(`/api/v1/menu/items/${itemId}/options`);

      expect(res.status).toBe(401);
    });

    it('rejects cross-tenant access', async () => {
      const ownerBSession = await createSession(tenantB.users.owner, tenantB.outlet.id);
      const ownerBApi = tenantApi(app, ownerBSession);

      const res = await ownerBApi.get(`/api/v1/menu/items/${itemId}/options`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/menu/items/:menuItemId/options/:id', () => {
    let optionId: string;

    beforeAll(async () => {
      const option = await prisma.menuItemOption.create({
        data: { menu_item_id: itemId, kind: 'variant', name: 'Test Option', price_delta: '15.00' },
      });
      optionId = option.id;
    });

    it('owner can get option details', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${itemId}/options/${optionId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.option.name).toBe('Test Option');
      expect(res.body.data.option.kind).toBe('variant');
      expect(res.body.data.option.price_delta).toBeDefined();
    });

    it('manager can get option details', async () => {
      const res = await managerAApi.get(`/api/v1/menu/items/${itemId}/options/${optionId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi.get(`/api/v1/menu/items/${itemId}/options/${optionId}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent option', async () => {
      const res = await ownerAApi.get(
        `/api/v1/menu/items/${itemId}/options/00000000-0000-0000-0000-000000000000`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${itemId}/options/not-a-uuid`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant access', async () => {
      // Create an item for tenantB
      const categoryB = await prisma.menuCategory.create({
        data: {
          organization_id: tenantB.organization.id,
          name: 'Tenant B Category',
          sort_order: 1,
        },
      });
      const itemB = await prisma.menuItem.create({
        data: {
          organization_id: tenantB.organization.id,
          category_id: categoryB.id,
          name: 'Tenant B Item',
          base_price: '100.00',
          is_active: true,
        },
      });
      const option = await prisma.menuItemOption.create({
        data: {
          menu_item_id: itemB.id,
          kind: 'addon',
          name: 'Tenant B Option',
          price_delta: '10.00',
        },
      });

      const res = await ownerAApi.get(`/api/v1/menu/items/${itemB.id}/options/${option.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/menu/items/:menuItemId/options', () => {
    it('owner can create variant option', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        kind: 'variant',
        name: 'New Variant',
        price_delta: 25.0,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.option.name).toBe('New Variant');
      expect(res.body.data.option.kind).toBe('variant');
      expect(Number(res.body.data.option.price_delta)).toBe(25);
    });

    it('owner can create addon option', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        kind: 'addon',
        name: 'New Addon',
        price_delta: 15.0,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.option.kind).toBe('addon');
    });

    it('manager can create option', async () => {
      const res = await managerAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        kind: 'variant',
        name: 'Manager Variant',
        price_delta: 30.0,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter creating option', async () => {
      const res = await waiterAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        kind: 'variant',
        name: 'Waiter Variant',
        price_delta: 10.0,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('validates required fields', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        price_delta: 10.0,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates kind enum', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        kind: 'invalid',
        name: 'Test',
        price_delta: 10.0,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates name length', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        kind: 'variant',
        name: '',
        price_delta: 10.0,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const longName = 'a'.repeat(101);
      const res2 = await ownerAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        kind: 'variant',
        name: longName,
        price_delta: 10.0,
      });
      expect(res2.status).toBe(400);
    });

    it('defaults price_delta to 0', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        kind: 'addon',
        name: 'Free Addon',
      });

      expect(res.status).toBe(201);
      expect(Number(res.body.data.option.price_delta)).toBe(0);
    });

    it('rejects duplicate name for same menu item', async () => {
      const res = await ownerAApi.post(`/api/v1/menu/items/${itemId}/options`, {
        kind: 'variant',
        name: 'New Variant',
        price_delta: 25.0,
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent menu item', async () => {
      const res = await ownerAApi.post(
        '/api/v1/menu/items/00000000-0000-0000-0000-000000000000/options',
        {
          kind: 'variant',
          name: 'Test',
          price_delta: 10.0,
        },
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/menu/items/:menuItemId/options/:id', () => {
    let optionId: string;

    beforeAll(async () => {
      const option = await prisma.menuItemOption.create({
        data: { menu_item_id: itemId, kind: 'variant', name: 'Update Me', price_delta: '10.00' },
      });
      optionId = option.id;
    });

    it('owner can update option name', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/options/${optionId}`, {
        name: 'Updated Name',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.option.name).toBe('Updated Name');
    });

    it('owner can update kind', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/options/${optionId}`, {
        kind: 'addon',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.option.kind).toBe('addon');
    });

    it('owner can update price_delta', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/options/${optionId}`, {
        price_delta: 50.0,
      });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.option.price_delta)).toBe(50);
    });

    it('owner can update is_active', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/options/${optionId}`, {
        is_active: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.option.is_active).toBe(false);
    });

    it('manager can update option', async () => {
      const option = await prisma.menuItemOption.create({
        data: {
          menu_item_id: itemId,
          kind: 'variant',
          name: 'Manager Update',
          price_delta: '20.00',
        },
      });

      const res = await managerAApi.patch(`/api/v1/menu/items/${itemId}/options/${option.id}`, {
        name: 'Manager Updated',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.option.name).toBe('Manager Updated');
    });

    it('rejects waiter updating option', async () => {
      const res = await waiterAApi.patch(`/api/v1/menu/items/${itemId}/options/${optionId}`, {
        name: 'Waiter Update',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent option', async () => {
      const res = await ownerAApi.patch(
        `/api/v1/menu/items/${itemId}/options/00000000-0000-0000-0000-000000000000`,
        {
          name: 'Test',
        },
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects duplicate name', async () => {
      await prisma.menuItemOption.create({
        data: {
          menu_item_id: itemId,
          kind: 'variant',
          name: 'Existing Option',
          price_delta: '15.00',
        },
      });

      const option = await prisma.menuItemOption.create({
        data: {
          menu_item_id: itemId,
          kind: 'variant',
          name: 'Another Option',
          price_delta: '20.00',
        },
      });

      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/options/${option.id}`, {
        name: 'Existing Option',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/menu/items/:menuItemId/options/:id', () => {
    it('owner can delete option', async () => {
      const option = await prisma.menuItemOption.create({
        data: { menu_item_id: itemId, kind: 'variant', name: 'Delete Me', price_delta: '10.00' },
      });

      const res = await ownerAApi.delete(`/api/v1/menu/items/${itemId}/options/${option.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.option.is_active).toBe(false);
    });

    it('manager can delete option', async () => {
      const option = await prisma.menuItemOption.create({
        data: { menu_item_id: itemId, kind: 'addon', name: 'Manager Delete', price_delta: '15.00' },
      });

      const res = await managerAApi.delete(`/api/v1/menu/items/${itemId}/options/${option.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter deleting option', async () => {
      const option = await prisma.menuItemOption.create({
        data: {
          menu_item_id: itemId,
          kind: 'variant',
          name: 'Waiter Delete',
          price_delta: '20.00',
        },
      });

      const res = await waiterAApi.delete(`/api/v1/menu/items/${itemId}/options/${option.id}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent option', async () => {
      const res = await ownerAApi.delete(
        `/api/v1/menu/items/${itemId}/options/00000000-0000-0000-0000-000000000000`,
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects cross-tenant deletion', async () => {
      // Create an item for tenantB
      const categoryB = await prisma.menuCategory.create({
        data: {
          organization_id: tenantB.organization.id,
          name: 'Tenant B Category',
          sort_order: 1,
        },
      });
      const itemB = await prisma.menuItem.create({
        data: {
          organization_id: tenantB.organization.id,
          category_id: categoryB.id,
          name: 'Tenant B Item',
          base_price: '100.00',
          is_active: true,
        },
      });
      const option = await prisma.menuItemOption.create({
        data: {
          menu_item_id: itemB.id,
          kind: 'variant',
          name: 'Tenant B Option',
          price_delta: '10.00',
        },
      });

      const res = await ownerAApi.delete(`/api/v1/menu/items/${itemB.id}/options/${option.id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
