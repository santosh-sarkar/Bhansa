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

interface TenantWithItem extends TestTenant {
  item1Id: string;
}

// Helper function to create a table and session with an order
async function createTestSession(
  tenant: TenantWithItem,
  tableLabel: string,
  orderNumber: number,
  quantity: number = 1,
): Promise<{ session: any; table: any; billId: string }> {
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
      status: 'completed',
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
          status: 'served',
          options: {},
        },
      },
    },
  });

  // Generate bill
  const api = tenantApi(app, await createSession(tenant.users.owner, tenant.outlet.id));
  const billRes = await api.post(`/api/v1/sessions/${session.id}/bill`).send({});
  const billId = billRes.body.data.id;

  return { session, table, billId };
}

describe('Cash Payment', () => {
  let tenantA: TenantWithItem;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;

  beforeAll(async () => {
    await resetDatabase();
    const { tenantA: a } = await createIsolatedTenants();
    tenantA = a as TenantWithItem;

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

  describe('POST /api/v1/bills/:id/payment/cash', () => {
    it('owner can record cash payment for a bill', async () => {
      const { billId } = await createTestSession(tenantA, 'Cash Table 1', 1000, 1);

      const res = await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '113.00',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.method).toBe('cash');
      expect(res.body.data.status).toBe('succeeded');
      expect(res.body.data.amount).toBe('113.00');
      expect(res.body.data.transaction_uuid).toBeDefined();
      expect(res.body.data.verified_at).toBeDefined();
      expect(res.body.data.recorded_by).toBe(ownerASession.userId);

      // Verify bill is marked as paid
      const bill = await prisma.bill.findUnique({ where: { id: billId } });
      expect(bill?.status).toBe('paid');
      expect(bill?.paid_at).toBeDefined();
      expect(bill?.session_id).toBeDefined();

      // Verify session is closed
      const session = await prisma.tableSession.findUnique({ where: { id: bill!.session_id! } });
      expect(session?.status).toBe('closed');
      expect(session?.closed_at).toBeDefined();

      // Verify table is freed
      const table = await prisma.diningTable.findUnique({ where: { id: session!.table_id } });
      expect(table?.status).toBe('free');

      // Verify order is completed
      const orders = await prisma.order.findMany({ where: { session_id: session!.id } });
      expect(orders.every((o) => o.status === 'completed')).toBe(true);
    });

    it('owner can record cash payment with idempotency key', async () => {
      const { billId } = await createTestSession(tenantA, 'Cash Table 2', 1001, 1);
      const idempotencyKey = `idem-${Date.now()}`;

      const res = await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '113.00',
        idempotency_key: idempotencyKey,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.idempotency_key).toBe(idempotencyKey);

      // Try again with same idempotency key - should fail
      const res2 = await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '113.00',
        idempotency_key: idempotencyKey,
      });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('CONFLICT');
    });

    it('returns 400 for amount not matching bill total', async () => {
      const { billId } = await createTestSession(tenantA, 'Cash Table 3', 1002, 1);

      const res = await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '100.00', // Wrong amount
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for already paid bill', async () => {
      const { billId } = await createTestSession(tenantA, 'Cash Table 4', 1003, 1);

      // First payment
      await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '113.00',
      });

      // Second payment on same bill
      const res = await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '113.00',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for non-existent bill', async () => {
      const res = await ownerAApi.post('/api/v1/bills/00000000-0000-0000-0000-000000000000/payment/cash').send({
        amount: '113.00',
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('tenant isolation - cannot pay other tenant bill', async () => {
      const { tenantB } = await createIsolatedTenants();
      await createTrialSubscription(tenantB.organization.id);

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

      const { billId } = await createTestSession(
        { ...tenantB, item1Id: item1B.id } as any,
        'Cash Table B',
        2000,
        1,
      );

      const res = await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '113.00',
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('waiter can record cash payment (has payment.record permission)', async () => {
      const { billId } = await createTestSession(tenantA, 'Cash Table 5', 1004, 1);

      const res = await waiterAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '113.00',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.method).toBe('cash');
    });

    it('returns 400 for session with uncompleted orders', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Cash Table 6',
          seats: 4,
          qr_token: `qr-cash-table-6-${Date.now()}`,
          is_active: true,
        },
      });

      const session = await prisma.tableSession.create({
        data: {
          outlet_id: tenantA.outlet.id,
          table_id: table.id,
          status: 'bill_requested',
          guest_token: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
      });

      // Create an order that is NOT completed
      await prisma.order.create({
        data: {
          outlet_id: tenantA.outlet.id,
          session_id: session.id,
          table_id: table.id,
          order_number: 1005,
          order_type: 'dine_in',
          status: 'served', // Not completed
          subtotal: 100,
          tax_amount: 13,
          discount_amount: 0,
          total: 113,
          items: {
            create: {
              outlet_id: tenantA.outlet.id,
              menu_item_id: tenantA.item1Id,
              item_name: 'Test Item 1',
              quantity: 1,
              unit_price: 100,
              line_total: 100,
              status: 'served',
              options: {},
            },
          },
        },
      });

      const api = tenantApi(app, await createSession(tenantA.users.owner, tenantA.outlet.id));
      const billRes = await api.post(`/api/v1/sessions/${session.id}/bill`).send({});
      const billId = billRes.body.data.id;

      const res = await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '113.00',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/payments/:id', () => {
    it('owner can get payment by ID', async () => {
      const { billId } = await createTestSession(tenantA, 'Payment Get Table 1', 1006, 1);

      const paymentRes = await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({
        amount: '113.00',
      });
      const paymentId = paymentRes.body.data.id;

      const res = await ownerAApi.get(`/api/v1/payments/${paymentId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(paymentId);
      expect(res.body.data.amount).toBe('113.00');
      expect(res.body.data.method).toBe('cash');
      expect(res.body.data.invoice_number).toBeDefined();
    });

    it('returns 404 for non-existent payment', async () => {
      const res = await ownerAApi.get('/api/v1/payments/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/payments', () => {
    it('owner can list payments', async () => {
      for (let i = 0; i < 3; i++) {
        const { billId } = await createTestSession(tenantA, `Payment List Table ${i}`, 2000 + i, 1);
        await ownerAApi.post(`/api/v1/bills/${billId}/payment/cash`).send({ amount: '113.00' });
      }

      const res = await ownerAApi.get('/api/v1/payments');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
    });

    it('supports pagination', async () => {
      const res = await ownerAApi.get('/api/v1/payments?page=1&limit=2');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
    });

    it('filters by method', async () => {
      const res = await ownerAApi.get('/api/v1/payments?method=cash');

      expect(res.status).toBe(200);
      expect(res.body.data.every((p: any) => p.method === 'cash')).toBe(true);
    });

    it('filters by status', async () => {
      const res = await ownerAApi.get('/api/v1/payments?status=succeeded');

      expect(res.status).toBe(200);
      expect(res.body.data.every((p: any) => p.status === 'succeeded')).toBe(true);
    });
  });
});