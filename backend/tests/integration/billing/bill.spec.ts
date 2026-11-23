import { beforeAll, describe, expect, it } from '@jest/globals';

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

// Helper function to create a table and session with an order
interface TenantWithItem extends TestTenant {
  item1Id: string;
}

async function createTestSession(
  tenant: TenantWithItem,
  tableLabel: string,
  orderNumber: number,
  quantity: number = 1,
): Promise<{ session: any; table: any }> {
  const table = await prisma.diningTable.create({
    data: {
      outlet_id: tenant.outlet.id,
      label: tableLabel,
      seats: 4,
      qr_token: `qr-${tableLabel.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      is_active: true,
    },
  });

  const session = await prisma.tableSession.create({
    data: {
      outlet_id: tenant.outlet.id,
      table_id: table.id,
      status: 'open',
      guest_token: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });

  await prisma.order.create({
    data: {
      outlet_id: tenant.outlet.id,
      session_id: session.id,
      table_id: table.id,
      order_number: orderNumber,
      order_type: 'dine_in',
      status: 'placed',
      subtotal: 100 * quantity,
      tax_amount: 13 * quantity,
      discount_amount: 0,
      total: 113 * quantity,
      items: {
        create: {
          outlet_id: tenant.outlet.id,
          menu_item_id: tenant.item1Id,
          item_name: 'Test Item 1',
          quantity,
          unit_price: 100,
          line_total: 100 * quantity,
          status: 'placed',
          options: {},
        },
      },
    },
  });

  return { session, table };
}

describe('Bill Generation', () => {
  let tenantA: TestTenant & { item1Id: string };
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;

  beforeAll(async () => {
    await resetDatabase();
    const { tenantA: a } = await createIsolatedTenants();
    tenantA = a as TestTenant & { item1Id: string };

    await createTrialSubscription(tenantA.organization.id);

    ownerASession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    managerASession = await createSession(tenantA.users.manager, tenantA.outlet.id);
    waiterASession = await createSession(tenantA.users.waiter, tenantA.outlet.id);

    ownerAApi = tenantApi(app, ownerASession);
    managerAApi = tenantApi(app, managerASession);
    waiterAApi = tenantApi(app, waiterASession);

    // Create category and menu item
    const category = await prisma.menuCategory.create({
      data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
    });

    const item1 = await prisma.menuItem.create({
      data: {
        organization_id: tenantA.organization.id,
        category_id: category.id,
        name: 'Test Item 1',
        base_price: '100.00',
        is_active: true,
      },
    });
    tenantA.item1Id = item1.id;
  });

  describe('POST /api/v1/sessions/:id/bill', () => {
    it('owner can generate bill for a session', async () => {
      const { session } = await createTestSession(tenantA, 'Test Table 1', 1000, 2);

      const res = await ownerAApi.post(`/api/v1/sessions/${session.id}/bill`).send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoice_number).toBeDefined();
      expect(res.body.data.subtotal).toBe('200.00');
      expect(res.body.data.tax_amount).toBe('26.00');
      expect(res.body.data.service_charge).toBe('20.00');
      expect(res.body.data.discount_amount).toBe('0.00');
      expect(res.body.data.total).toBe('246.00');
      expect(res.body.data.status).toBe('open');
      expect(res.body.data.orders).toHaveLength(1);
    });

    it('owner can generate bill with discount', async () => {
      const { session } = await createTestSession(tenantA, 'Test Table 2', 1001, 1);

      const res = await ownerAApi.post(`/api/v1/sessions/${session.id}/bill`).send({
        discount_amount: '10.00',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subtotal).toBe('100.00');
      expect(res.body.data.tax_amount).toBe('13.00');
      expect(res.body.data.service_charge).toBe('10.00');
      expect(res.body.data.discount_amount).toBe('10.00');
      expect(res.body.data.total).toBe('113.00');
    });

    it('waiter cannot apply discount (no billing.manage permission)', async () => {
      const { session } = await createTestSession(tenantA, 'Test Table 3', 1002, 1);

      const res = await waiterAApi.post(`/api/v1/sessions/${session.id}/bill`).send({
        discount_amount: '10.00',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('manager can apply discount (has billing.manage permission)', async () => {
      const { session } = await createTestSession(tenantA, 'Test Table 4', 1003, 1);

      const res = await managerAApi.post(`/api/v1/sessions/${session.id}/bill`).send({
        discount_amount: '10.00',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.discount_amount).toBe('10.00');
    });

    it('returns 404 for non-existent session', async () => {
      const res = await ownerAApi.post('/api/v1/sessions/00000000-0000-0000-0000-000000000000/bill').send({});

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for session with no orders', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Test Table 5',
          seats: 4,
          qr_token: 'qr-test-table-5',
          is_active: true,
        },
      });

      const session = await prisma.tableSession.create({
        data: {
          outlet_id: tenantA.outlet.id,
          table_id: table.id,
          status: 'open',
          guest_token: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      });

      const res = await ownerAApi.post(`/api/v1/sessions/${session.id}/bill`).send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for already closed session', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Test Table 6',
          seats: 4,
          qr_token: 'qr-test-table-6',
          is_active: true,
        },
      });

      const session = await prisma.tableSession.create({
        data: {
          outlet_id: tenantA.outlet.id,
          table_id: table.id,
          status: 'closed',
          guest_token: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      });

      const res = await ownerAApi.post(`/api/v1/sessions/${session.id}/bill`).send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('tenant isolation - cannot generate bill for other tenant session', async () => {
      // Create another tenant
      const { tenantB } = await createIsolatedTenants();
      await createTrialSubscription(tenantB.organization.id);

      // Create category and menu item for tenantB
      const categoryB = await prisma.menuCategory.create({
        data: { organization_id: tenantB.organization.id, name: 'Test Category B', sort_order: 1 },
      });
      const item1B = await prisma.menuItem.create({
        data: {
          organization_id: tenantB.organization.id,
          category_id: categoryB.id,
          name: 'Test Item 1B',
          base_price: '100.00',
          is_active: true,
        },
      });

      const { session } = await createTestSession(
        { ...tenantB, item1Id: item1B.id } as any,
        'Test Table B',
        2000,
        1,
      );

      const res = await ownerAApi.post(`/api/v1/sessions/${session.id}/bill`).send({});

      // Should return 403 FORBIDDEN (session exists but no access)
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/bills/:id', () => {
    it('owner can get bill by ID', async () => {
      const { session } = await createTestSession(tenantA, 'Test Table Get 1', 1004, 1);

      const billRes = await ownerAApi.post(`/api/v1/sessions/${session.id}/bill`).send({});
      const billId = billRes.body.data.id;

      const res = await ownerAApi.get(`/api/v1/bills/${billId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(billId);
      expect(res.body.data.invoice_number).toBeDefined();
      expect(res.body.data.orders).toHaveLength(1);
    });

    it('returns 404 for non-existent bill', async () => {
      const res = await ownerAApi.get('/api/v1/bills/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/bills', () => {
    it('owner can list bills', async () => {
      for (let i = 0; i < 3; i++) {
        const { session } = await createTestSession(tenantA, `Test Table List ${i}`, 2000 + i, 1);
        await ownerAApi.post(`/api/v1/sessions/${session.id}/bill`).send({});
      }

      const res = await ownerAApi.get('/api/v1/bills');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
    });

    it('supports pagination', async () => {
      const res = await ownerAApi.get('/api/v1/bills?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
    });

    it('filters by status', async () => {
      const res = await ownerAApi.get('/api/v1/bills?status=open');

      expect(res.status).toBe(200);
      expect(res.body.data.every((b: any) => b.status === 'open')).toBe(true);
    });
  });
});