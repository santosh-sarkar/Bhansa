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

describe('Menu Item Outlet Overrides', () => {
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
  let itemId: string;
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

    // Create a second outlet in the same organization for testing multiple overrides
    const outlet2 = await prisma.outlet.create({
      data: {
        organization_id: tenantA.organization.id,
        name: 'Second Outlet',
      },
    });
    outlet2Id = outlet2.id;
  });

  describe('GET /api/v1/menu/items/:id/outlet-overrides', () => {
    beforeAll(async () => {
      // Create some outlet overrides
      await prisma.menuItemOutletOverride.createMany({
        data: [
          {
            menu_item_id: itemId,
            outlet_id: tenantA.outlet.id,
            price_override: '150.00',
            is_available: true,
            auto_unavailable: false,
          },
          {
            menu_item_id: itemId,
            outlet_id: outlet2Id,
            price_override: '200.00',
            is_available: false,
            auto_unavailable: true,
          },
        ],
      });
    });

    it('owner can list outlet overrides', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${itemId}/outlet-overrides`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].outlet_id).toBe(tenantA.outlet.id);
      expect(res.body.data[0].price_override).toBe('150.00');
      expect(res.body.data[0].is_available).toBe(true);
      expect(res.body.data[0].outlet).toBeDefined();
    });

    it('manager can list outlet overrides for assigned outlet', async () => {
      const res = await managerAApi.get(`/api/v1/menu/items/${itemId}/outlet-overrides`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi.get(`/api/v1/menu/items/${itemId}/outlet-overrides`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent menu item', async () => {
      const res = await ownerAApi.get(
        '/api/v1/menu/items/00000000-0000-0000-0000-000000000000/outlet-overrides',
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('owner can see all outlets in their organization (including other outlets in same org)', async () => {
      const res = await ownerAApi.get(`/api/v1/menu/items/${itemId}/outlet-overrides`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Owner has org-wide access, sees all outlets in the organization
      expect(res.body.data.length).toBe(2);
      const outletIds = res.body.data.map((o: { outlet_id: string }) => o.outlet_id);
      expect(outletIds).toContain(tenantA.outlet.id);
      expect(outletIds).toContain(outlet2Id);
    });
  });

  describe('PUT /api/v1/menu/items/:id/outlet-overrides', () => {
    it('owner can create outlet override', async () => {
      const res = await ownerAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            outlet_id: tenantA.outlet.id,
            price_override: 150.0,
            is_available: true,
            auto_unavailable: false,
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].price_override).toBe('150.00');
      expect(res.body.data[0].is_available).toBe(true);
      expect(res.body.data[0].auto_unavailable).toBe(false);
    });

    it('owner can create multiple outlet overrides', async () => {
      const res = await ownerAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            outlet_id: tenantA.outlet.id,
            price_override: 120.0,
            is_available: true,
          },
          {
            outlet_id: outlet2Id,
            price_override: 180.0,
            is_available: false,
            auto_unavailable: true,
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('manager can create override for assigned outlet', async () => {
      const res = await managerAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            outlet_id: tenantA.outlet.id,
            price_override: 130.0,
            is_available: true,
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects manager creating override for unassigned outlet', async () => {
      const res = await managerAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            outlet_id: outlet2Id,
            price_override: 150.0,
            is_available: true,
          },
        ],
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects waiter creating override', async () => {
      const res = await waiterAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            outlet_id: tenantA.outlet.id,
            price_override: 150.0,
            is_available: true,
          },
        ],
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('validates required outlet_id', async () => {
      const res = await ownerAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            price_override: 150.0,
            is_available: true,
          },
        ],
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates outlet_id format', async () => {
      const res = await ownerAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            outlet_id: 'not-a-uuid',
            price_override: 150.0,
            is_available: true,
          },
        ],
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent outlet', async () => {
      const res = await ownerAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            outlet_id: '00000000-0000-0000-0000-000000000000',
            price_override: 150.0,
            is_available: true,
          },
        ],
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent menu item', async () => {
      const res = await ownerAApi.put(
        '/api/v1/menu/items/00000000-0000-0000-0000-000000000000/outlet-overrides',
        {
          overrides: [
            {
              outlet_id: tenantA.outlet.id,
              price_override: 150.0,
              is_available: true,
            },
          ],
        },
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid price_override', async () => {
      const res = await ownerAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            outlet_id: tenantA.outlet.id,
            price_override: -10.0,
            is_available: true,
          },
        ],
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects price_override exceeding max', async () => {
      const res = await ownerAApi.put(`/api/v1/menu/items/${itemId}/outlet-overrides`, {
        overrides: [
          {
            outlet_id: tenantA.outlet.id,
            price_override: 1000000.0,
            is_available: true,
          },
        ],
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/menu/items/:id/availability', () => {
    beforeAll(async () => {
      // Create an outlet override with is_available = true for testing (upsert to handle existing)
      await prisma.menuItemOutletOverride.upsert({
        where: {
          menu_item_id_outlet_id: {
            menu_item_id: itemId,
            outlet_id: tenantA.outlet.id,
          },
        },
        update: {
          is_available: true,
          price_override: '150.00',
          auto_unavailable: false,
        },
        create: {
          menu_item_id: itemId,
          outlet_id: tenantA.outlet.id,
          price_override: '150.00',
          is_available: true,
          auto_unavailable: false,
        },
      });
    });

    it('owner can toggle availability to false', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: tenantA.outlet.id,
        is_available: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet_id).toBe(tenantA.outlet.id);
      expect(res.body.data.is_available).toBe(false);
      expect(res.body.data.outlet).toBeDefined();
    });

    it('owner can toggle availability back to true', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: tenantA.outlet.id,
        is_available: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_available).toBe(true);
    });

    it('manager can toggle availability for assigned outlet', async () => {
      const res = await managerAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: tenantA.outlet.id,
        is_available: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_available).toBe(false);
    });

    it('kitchen can toggle availability for assigned outlet', async () => {
      const res = await kitchenAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: tenantA.outlet.id,
        is_available: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_available).toBe(false);
    });

    it('rejects waiter without item.mark_unavailable permission', async () => {
      const res = await waiterAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: tenantA.outlet.id,
        is_available: false,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent menu item', async () => {
      const res = await ownerAApi.patch(
        '/api/v1/menu/items/00000000-0000-0000-0000-000000000000/availability',
        {
          outlet_id: tenantA.outlet.id,
          is_available: false,
        },
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent outlet', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: '00000000-0000-0000-0000-000000000000',
        is_available: false,
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('rejects manager toggling for unassigned outlet', async () => {
      const res = await managerAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: outlet2Id,
        is_available: false,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects kitchen toggling for unassigned outlet', async () => {
      const res = await kitchenAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: outlet2Id,
        is_available: false,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid outlet_id format', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: 'invalid-uuid',
        is_available: false,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing is_available in body', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: tenantA.outlet.id,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('owner can toggle availability for second outlet in same org', async () => {
      const res = await ownerAApi.patch(`/api/v1/menu/items/${itemId}/availability`, {
        outlet_id: outlet2Id,
        is_available: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outlet_id).toBe(outlet2Id);
      expect(res.body.data.is_available).toBe(false);
    });

    it('creates new override if none exists', async () => {
      // Use a fresh item with no existing overrides
      const freshItem = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Fresh Item',
          base_price: '100.00',
          is_active: true,
        },
      });

      const res = await ownerAApi.patch(`/api/v1/menu/items/${freshItem.id}/availability`, {
        outlet_id: tenantA.outlet.id,
        is_available: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_available).toBe(false);
      expect(res.body.data.price_override).toBeNull();
      expect(res.body.data.auto_unavailable).toBe(false);
    });
  });
});
