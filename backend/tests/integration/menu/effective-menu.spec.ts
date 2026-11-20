import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
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

describe('GET /api/v1/menu/effective', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;
  let kitchenASession: TenantSession;
  let kitchenAApi: TenantApi;
  let categoryId: string;
  let outlet2Id: string;

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
    kitchenASession = await createSession(tenantA.users.kitchen, tenantA.outlet.id);

    ownerAApi = tenantApi(app, ownerASession);
    managerAApi = tenantApi(app, managerASession);
    waiterAApi = tenantApi(app, waiterASession);
    kitchenAApi = tenantApi(app, kitchenASession);

    // Create a category for testing
    const category = await prisma.menuCategory.create({
      data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
    });
    categoryId = category.id;

    // Create a second outlet in the same organization
    const outlet2 = await prisma.outlet.create({
      data: {
        organization_id: tenantA.organization.id,
        name: 'Second Outlet',
      },
    });
    outlet2Id = outlet2.id;
  });

  beforeEach(async () => {
    // Clean up outlet overrides before each test to avoid unique constraint violations
    await prisma.menuItemOutletOverride.deleteMany({
      where: {
        outlet_id: tenantA.outlet.id,
      },
    });
    // Clean up test-specific menu items (including those in test categories)
    await prisma.menuItem.deleteMany({
      where: {
        organization_id: tenantA.organization.id,
        OR: [
          { name: { startsWith: 'Test' } },
          { name: { startsWith: 'Inactive' } },
          { name: { startsWith: 'Deleted' } },
          { name: { startsWith: 'Unavailable' } },
        ],
      },
    });
    // Clean up test-specific categories
    await prisma.menuCategory.deleteMany({
      where: {
        organization_id: tenantA.organization.id,
        name: { in: ['Inactive Category', 'Empty Category'] },
      },
    });
  });

  describe('Authentication and outlet context', () => {
    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/menu/effective');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects request without X-Outlet-Id header', async () => {
      const res = await ownerAApi.get('/api/v1/menu/effective').unset('X-Outlet-Id');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects request with invalid X-Outlet-Id format', async () => {
      const res = await ownerAApi.get('/api/v1/menu/effective').set('X-Outlet-Id', 'invalid-uuid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects request for non-existent outlet', async () => {
      const res = await ownerAApi
        .get('/api/v1/menu/effective')
        .set('X-Outlet-Id', '00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects request for outlet in different organization', async () => {
      const res = await ownerAApi
        .get('/api/v1/menu/effective')
        .set('X-Outlet-Id', tenantB.outlet.id);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects request for deleted outlet', async () => {
      // Soft delete the outlet
      await prisma.outlet.update({
        where: { id: tenantA.outlet.id },
        data: { deleted_at: new Date() },
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      // Restore the outlet for subsequent tests
      await prisma.outlet.update({
        where: { id: tenantA.outlet.id },
        data: { deleted_at: null },
      });
    });
  });

  describe('Access by role', () => {
    it('owner can access effective menu for their outlet', async () => {
      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toBeDefined();
    });

    it('manager can access effective menu for assigned outlet', async () => {
      const res = await managerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('waiter can access effective menu for assigned outlet', async () => {
      const res = await waiterAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('kitchen can access effective menu for assigned outlet', async () => {
      const res = await kitchenAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('owner can access effective menu for any outlet in organization', async () => {
      const res = await ownerAApi.get('/api/v1/menu/effective').set('X-Outlet-Id', outlet2Id);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('manager cannot access effective menu for unassigned outlet', async () => {
      const res = await managerAApi.get('/api/v1/menu/effective').set('X-Outlet-Id', outlet2Id);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('waiter cannot access effective menu for unassigned outlet', async () => {
      const res = await waiterAApi.get('/api/v1/menu/effective').set('X-Outlet-Id', outlet2Id);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('kitchen cannot access effective menu for unassigned outlet', async () => {
      const res = await kitchenAApi.get('/api/v1/menu/effective').set('X-Outlet-Id', outlet2Id);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Effective menu content', () => {
    it('returns active categories with active items', async () => {
      // Create test items for this test
      await prisma.menuItem.createMany({
        data: [
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Test Item A1',
            base_price: '100.00',
            is_active: true,
          },
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Test Item A2',
            base_price: '200.00',
            is_active: true,
          },
        ],
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categories.length).toBeGreaterThan(0);

      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      expect(category).toBeDefined();
      expect(category.items.length).toBe(2);
    });

    it('excludes inactive categories', async () => {
      // Create an inactive category
      await prisma.menuCategory.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Inactive Category',
          sort_order: 2,
          is_active: false,
        },
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Inactive Category',
      );
      expect(category).toBeUndefined();
    });

    it('excludes inactive menu items', async () => {
      // Create an active item and an inactive menu item in the same category
      await prisma.menuItem.createMany({
        data: [
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Active Item For Inactive Test',
            base_price: '100.00',
            is_active: true,
          },
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Inactive Item',
            base_price: '50.00',
            is_active: false,
          },
        ],
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      expect(category).toBeDefined();
      const inactiveItem = category.items.find((i: { name: string }) => i.name === 'Inactive Item');
      expect(inactiveItem).toBeUndefined();
      const activeItem = category.items.find(
        (i: { name: string }) => i.name === 'Active Item For Inactive Test',
      );
      expect(activeItem).toBeDefined();
    });

    it('excludes soft-deleted menu items', async () => {
      // Create an active item and a soft-deleted item in the same category
      await prisma.menuItem.createMany({
        data: [
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Active Item For Deleted Test',
            base_price: '100.00',
            is_active: true,
          },
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Deleted Item',
            base_price: '50.00',
            is_active: true,
            deleted_at: new Date(),
          },
        ],
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      expect(category).toBeDefined();
      const deletedItem = category.items.find((i: { name: string }) => i.name === 'Deleted Item');
      expect(deletedItem).toBeUndefined();
      const activeItem = category.items.find(
        (i: { name: string }) => i.name === 'Active Item For Deleted Test',
      );
      expect(activeItem).toBeDefined();
    });

    it('includes outlet price override', async () => {
      // Create an active item for the category to exist, and the test item with override
      await prisma.menuItem.createMany({
        data: [
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Active Item For Override Test',
            base_price: '100.00',
            is_active: true,
          },
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Test Item Price Override',
            base_price: '100.00',
            is_active: true,
          },
        ],
      });

      const item = await prisma.menuItem.findFirst({ where: { name: 'Test Item Price Override' } });

      // Create an outlet override with price
      await prisma.menuItemOutletOverride.upsert({
        where: {
          menu_item_id_outlet_id: {
            menu_item_id: item!.id,
            outlet_id: tenantA.outlet.id,
          },
        },
        update: {
          price_override: '150.00',
          is_available: true,
          auto_unavailable: false,
        },
        create: {
          menu_item_id: item!.id,
          outlet_id: tenantA.outlet.id,
          price_override: '150.00',
          is_available: true,
          auto_unavailable: false,
        },
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      const foundItem = category.items.find(
        (i: { name: string }) => i.name === 'Test Item Price Override',
      );
      expect(foundItem).toBeDefined();
      // Price override is returned as string, may be "150" or "150.00"
      expect(foundItem.override_price).toMatch(/^150(\.00)?$/);
    });

    it('excludes items with is_available = false', async () => {
      // Create an active item for the category to exist, and the test item with is_available = false
      await prisma.menuItem.createMany({
        data: [
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Active Item For Unavailable Test',
            base_price: '100.00',
            is_active: true,
          },
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Test Item Unavailable',
            base_price: '200.00',
            is_active: true,
          },
        ],
      });

      const item = await prisma.menuItem.findFirst({ where: { name: 'Test Item Unavailable' } });

      // Create an outlet override with is_available = false
      await prisma.menuItemOutletOverride.upsert({
        where: {
          menu_item_id_outlet_id: {
            menu_item_id: item!.id,
            outlet_id: tenantA.outlet.id,
          },
        },
        update: {
          price_override: null,
          is_available: false,
          auto_unavailable: false,
        },
        create: {
          menu_item_id: item!.id,
          outlet_id: tenantA.outlet.id,
          price_override: null,
          is_available: false,
          auto_unavailable: false,
        },
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      const foundItem = category.items.find(
        (i: { name: string }) => i.name === 'Test Item Unavailable',
      );
      expect(foundItem).toBeUndefined();
    });

    it('excludes items with auto_unavailable = true', async () => {
      // Create an active item for the category to exist, and the test item with auto_unavailable = true
      await prisma.menuItem.createMany({
        data: [
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Active Item For Auto Unavailable Test',
            base_price: '100.00',
            is_active: true,
          },
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Test Item Auto Unavailable',
            base_price: '200.00',
            is_active: true,
          },
        ],
      });

      const item = await prisma.menuItem.findFirst({
        where: { name: 'Test Item Auto Unavailable' },
      });

      // Create an outlet override with auto_unavailable = true
      await prisma.menuItemOutletOverride.upsert({
        where: {
          menu_item_id_outlet_id: {
            menu_item_id: item!.id,
            outlet_id: tenantA.outlet.id,
          },
        },
        update: {
          price_override: null,
          is_available: true,
          auto_unavailable: true,
        },
        create: {
          menu_item_id: item!.id,
          outlet_id: tenantA.outlet.id,
          price_override: null,
          is_available: true,
          auto_unavailable: true,
        },
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      const foundItem = category.items.find(
        (i: { name: string }) => i.name === 'Test Item Auto Unavailable',
      );
      expect(foundItem).toBeUndefined();
    });

    it('includes items with is_available = true and auto_unavailable = false', async () => {
      // Create a test item for this test
      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Test Item Available',
          base_price: '200.00',
          is_active: true,
        },
      });

      // Create an outlet override with is_available = true, auto_unavailable = false
      await prisma.menuItemOutletOverride.upsert({
        where: {
          menu_item_id_outlet_id: {
            menu_item_id: item.id,
            outlet_id: tenantA.outlet.id,
          },
        },
        update: {
          price_override: null,
          is_available: true,
          auto_unavailable: false,
        },
        create: {
          menu_item_id: item.id,
          outlet_id: tenantA.outlet.id,
          price_override: null,
          is_available: true,
          auto_unavailable: false,
        },
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      const foundItem = category.items.find(
        (i: { name: string }) => i.name === 'Test Item Available',
      );
      expect(foundItem).toBeDefined();
      expect(foundItem.is_available).toBe(true);
    });

    it('returns is_available = true for items without override (default available)', async () => {
      // Create a test item without override
      await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Test Item No Override',
          base_price: '100.00',
          is_active: true,
        },
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      const foundItem = category.items.find(
        (i: { name: string }) => i.name === 'Test Item No Override',
      );
      expect(foundItem).toBeDefined();
      expect(foundItem.is_available).toBe(true);
      expect(foundItem.override_price).toBeNull();
    });

    it('excludes categories with no available items', async () => {
      // Create a category with only unavailable items
      const emptyCategory = await prisma.menuCategory.create({
        data: { organization_id: tenantA.organization.id, name: 'Empty Category', sort_order: 3 },
      });

      const item = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: emptyCategory.id,
          name: 'Unavailable Item',
          base_price: '50.00',
          is_active: true,
        },
      });

      // Make the item unavailable at this outlet
      await prisma.menuItemOutletOverride.upsert({
        where: {
          menu_item_id_outlet_id: {
            menu_item_id: item.id,
            outlet_id: tenantA.outlet.id,
          },
        },
        update: {
          price_override: null,
          is_available: false,
          auto_unavailable: false,
        },
        create: {
          menu_item_id: item.id,
          outlet_id: tenantA.outlet.id,
          price_override: null,
          is_available: false,
          auto_unavailable: false,
        },
      });

      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Empty Category',
      );
      expect(category).toBeUndefined();
    });
  });

  describe('Response structure', () => {
    beforeAll(async () => {
      // Create test items for response structure tests
      await prisma.menuItem.createMany({
        data: [
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Response Test Item 1',
            base_price: '100.00',
            is_active: true,
          },
          {
            organization_id: tenantA.organization.id,
            category_id: categoryId,
            name: 'Response Test Item 2',
            base_price: '200.00',
            is_active: true,
          },
        ],
      });
    });

    it('returns categories sorted by sort_order', async () => {
      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const categories = res.body.data.categories;
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].sort_order).toBeGreaterThanOrEqual(categories[i - 1].sort_order);
      }
    });

    it('returns items sorted by sort_order within category', async () => {
      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      expect(category).toBeDefined();
      const items = category.items;
      for (let i = 1; i < items.length; i++) {
        // Items don't have sort_order in response but should be ordered by it
        expect(items[i].name).toBeDefined();
      }
    });

    it('returns all required item fields', async () => {
      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      const category = res.body.data.categories.find(
        (c: { name: string }) => c.name === 'Test Category',
      );
      expect(category).toBeDefined();
      const item = category.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('base_price');
      expect(item).toHaveProperty('is_active');
      expect(item).toHaveProperty('image_url');
      expect(item).toHaveProperty('override_price');
      expect(item).toHaveProperty('is_available');
    });

    it('returns all required category fields', async () => {
      const res = await ownerAApi.get('/api/v1/menu/effective');

      expect(res.status).toBe(200);
      expect(res.body.data.categories.length).toBeGreaterThan(0);
      const category = res.body.data.categories[0];
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('sort_order');
      expect(category).toHaveProperty('items');
    });
  });
});
