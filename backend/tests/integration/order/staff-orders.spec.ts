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

describe('Staff Order Creation (Auto-confirmed)', () => {
  let tenantA: TestTenant;
  let waiterSession: TenantSession;
  let waiterApi: TenantApi;
  let kitchenSession: TenantSession;
  let kitchenApi: TenantApi;
  let categoryId: string;
  let item1Id: string;
  let tableId: string;

  beforeAll(async () => {
    await resetDatabase();
    const { tenantA: a } = await createIsolatedTenants();
    tenantA = a;

    await createTrialSubscription(tenantA.organization.id);

    waiterSession = await createSession(tenantA.users.waiter, tenantA.outlet.id);
    waiterApi = tenantApi(app, waiterSession);

    kitchenSession = await createSession(tenantA.users.kitchen, tenantA.outlet.id);
    kitchenApi = tenantApi(app, kitchenSession);

    const category = await prisma.menuCategory.create({
      data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
    });
    categoryId = category.id;

    const item1 = await prisma.menuItem.create({
      data: {
        organization_id: tenantA.organization.id,
        category_id: category.id,
        name: 'Test Item 1',
        base_price: '100.00',
        is_active: true,
      },
    });
    item1Id = item1.id;

    const table = await prisma.diningTable.create({
      data: {
        outlet_id: tenantA.outlet.id,
        label: 'Test Table 1',
        seats: 4,
        qr_token: 'qr-staff-table-1',
        is_active: true,
      },
    });
    tableId = table.id;
  });

  describe('POST /api/v1/orders (staff)', () => {
    it('should create an auto-confirmed order for a table as waiter', async () => {
      const res = await waiterApi.post('/api/v1/orders', {
        table_id: tableId,
        items: [{ menuItemId: item1Id, quantity: 2 }],
        notes: 'Extra spicy',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.id).toBeDefined();
      expect(res.body.data.order.status).toBe('placed'); // Auto-confirmed
      expect(res.body.data.order.items.length).toBe(1);
      expect(res.body.data.order.items[0].quantity).toBe(2);
      expect(res.body.data.order.notes).toBe('Extra spicy');

      // Verify table status changed to occupied
      const table = await prisma.diningTable.findUnique({ where: { id: tableId } });
      expect(table?.status).toBe('occupied');
    });

    it('should create order with options', async () => {
      // Create an option for the item
      const option = await prisma.menuItemOption.create({
        data: {
          menu_item_id: item1Id,
          name: 'Extra Cheese',
          kind: 'addon',
          price_delta: '25.00',
          is_active: true,
        },
      });

      const res = await waiterApi.post('/api/v1/orders', {
        table_id: tableId,
        items: [
          {
            menuItemId: item1Id,
            quantity: 1,
            options: [{ optionId: option.id, quantity: 1 }],
          },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.data.order.items[0].options).toHaveLength(1);
      expect(res.body.data.order.items[0].options[0].name).toBe('Extra Cheese');
    });

    it('should return 404 for non-existent table', async () => {
      const fakeTableId = '00000000-0000-0000-0000-000000000000';
      const res = await waiterApi.post('/api/v1/orders', {
        table_id: fakeTableId,
        items: [{ menuItemId: item1Id, quantity: 1 }],
      });

      expect(res.status).toBe(404);
    });

    it('should return 400 for inactive table', async () => {
      const inactiveTable = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Inactive Table',
          seats: 2,
          qr_token: 'qr-inactive-table',
          is_active: false,
        },
      });

      const res = await waiterApi.post('/api/v1/orders', {
        table_id: inactiveTable.id,
        items: [{ menuItemId: item1Id, quantity: 1 }],
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for table in different outlet', async () => {
      const otherOutlet = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Other Outlet',
          address: 'Other Address',
          phone: '1234567890',
          timezone: 'UTC',
          tax_percent: '13.00',
          service_charge_percent: '10.00',
        },
      });

      const otherTable = await prisma.diningTable.create({
        data: {
          outlet_id: otherOutlet.id,
          label: 'Other Table',
          seats: 4,
          qr_token: 'qr-other-table',
          is_active: true,
        },
      });

      const res = await waiterApi.post('/api/v1/orders', {
        table_id: otherTable.id,
        items: [{ menuItemId: item1Id, quantity: 1 }],
      });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent menu item', async () => {
      const fakeItemId = '00000000-0000-0000-0000-000000000000';
      const res = await waiterApi.post('/api/v1/orders', {
        table_id: tableId,
        items: [{ menuItemId: fakeItemId, quantity: 1 }],
      });

      expect(res.status).toBe(404);
    });

    it('should return 404 for unavailable menu item', async () => {
      const inactiveItem = await prisma.menuItem.create({
        data: {
          organization_id: tenantA.organization.id,
          category_id: categoryId,
          name: 'Inactive Item',
          base_price: '50.00',
          is_active: false,
        },
      });

      const res = await waiterApi.post('/api/v1/orders', {
        table_id: tableId,
        items: [{ menuItemId: inactiveItem.id, quantity: 1 }],
      });

      // Inactive items are not in effective menu, so 404
      expect(res.status).toBe(404);
    });

    it('should return 400 without items', async () => {
      const res = await waiterApi.post('/api/v1/orders', {
        table_id: tableId,
        items: [],
      });

      expect(res.status).toBe(400);
    });

    it('should allow manager to create order', async () => {
      const managerSession = await createSession(tenantA.users.manager, tenantA.outlet.id);
      const managerApi = tenantApi(app, managerSession);

      const res = await managerApi.post('/api/v1/orders', {
        table_id: tableId,
        items: [{ menuItemId: item1Id, quantity: 1 }],
      });

      expect(res.status).toBe(201);
      expect(res.body.data.order.status).toBe('placed');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          table_id: tableId,
          items: [{ menuItemId: item1Id, quantity: 1 }],
        })
        .set('X-Outlet-Id', tenantA.outlet.id);

      expect(res.status).toBe(401);
    });

    it('should calculate pricing correctly with tax and service charge', async () => {
      const res = await waiterApi.post('/api/v1/orders', {
        table_id: tableId,
        items: [{ menuItemId: item1Id, quantity: 2 }], // 2 * 100 = 200
      });

      expect(res.status).toBe(201);
      // subtotal = 200
      // tax = 200 * 13% = 26
      // service = 200 * 10% = 20
      // total = 246
      expect(res.body.data.order.subtotal).toBe('200.00');
      expect(res.body.data.order.tax_amount).toBe('26.00');
      expect(res.body.data.order.discount_amount).toBe('0.00');
      expect(res.body.data.order.total).toBe('246.00');
    });
  });
});
