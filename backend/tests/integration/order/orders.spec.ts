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

// Helper function to extract guest token from session response
function getGuestToken(res: request.Response): string {
  const cookie = res.headers['set-cookie']?.[0];
  if (!cookie) throw new Error('No guest cookie received');
  const firstPart = cookie.split(';')[0];
  if (!firstPart) throw new Error('Invalid cookie format');
  const parts = firstPart.split('=');
  if (parts.length < 2) throw new Error('No guest token in cookie');
  const token = parts[1];
  if (!token) throw new Error('No guest token in cookie');
  return token;
}

// Helper to create a fresh table, guest session, and pending order
async function createTestScenario(
  appInstance: ReturnType<typeof createApp>,
  outletId: string,
  itemId: string,
  idempotencyKey: string,
): Promise<{ orderId: string; guestToken: string; tableId: string }> {
  // Create a fresh table for this test
  const table = await prisma.diningTable.create({
    data: {
      outlet_id: outletId,
      label: `Test Table ${Date.now()}`,
      seats: 4,
      qr_token: `qr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      is_active: true,
    },
  });

  const guestSession = await request(appInstance)
    .post('/api/v1/public/sessions')
    .send({ qrToken: table.qr_token });

  const guestToken = getGuestToken(guestSession);

  const orderRes = await request(appInstance)
    .post('/api/v1/public/orders')
    .set('Cookie', `guest_token=${guestToken}`)
    .send({
      idempotencyKey,
      items: [{ menuItemId: itemId, quantity: 1 }],
    });

  return { orderId: orderRes.body.data.order.id, guestToken, tableId: table.id };
}

describe('Staff Orders - Waiter Endpoints', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let waiterSession: TenantSession;
  let waiterApi: TenantApi;
  let kitchenSession: TenantSession;
  let kitchenApi: TenantApi;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let categoryId: string;
  let item1Id: string;

  beforeAll(async () => {
    await resetDatabase();
    const { tenantA: a, tenantB: b } = await createIsolatedTenants();
    tenantA = a;
    tenantB = b;

    // Create subscriptions for both tenants
    await createTrialSubscription(tenantA.organization.id);
    await createTrialSubscription(tenantB.organization.id);

    // Create sessions
    waiterSession = await createSession(tenantA.users.waiter, tenantA.outlet.id);
    waiterApi = tenantApi(app, waiterSession);

    kitchenSession = await createSession(tenantA.users.kitchen, tenantA.outlet.id);
    kitchenApi = tenantApi(app, kitchenSession);

    ownerASession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    ownerAApi = tenantApi(app, ownerASession);

    // Create a category and items for testing
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
  });

  describe('GET /api/v1/orders?status=pending_confirmation', () => {
    it('should list pending orders for waiter', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-list-${Date.now()}`,
      );

      const res = await waiterApi.get('/api/v1/orders?status=pending_confirmation&limit=20');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const pendingOrder = res.body.data.find((o: any) => o.id === orderId);
      expect(pendingOrder).toBeDefined();
      expect(pendingOrder.status).toBe('pending_confirmation');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .query({ status: 'pending_confirmation' })
        .set('X-Outlet-Id', tenantA.outlet.id);

      expect(res.status).toBe(401);
    });

    it('should return 403 for waiter from different outlet', async () => {
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

      const res = await request(app)
        .get('/api/v1/orders')
        .query({ status: 'pending_confirmation' })
        .set('Cookie', waiterSession.cookie)
        .set('X-Outlet-Id', otherOutlet.id);

      // Waiter is not assigned to otherOutlet, should be forbidden
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('PATCH /api/v1/orders/:id/confirm', () => {
    it('should confirm a pending order as waiter', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-confirm-${Date.now()}`,
      );

      const res = await waiterApi.patch(`/api/v1/orders/${orderId}/confirm`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.id).toBe(orderId);
      expect(res.body.data.order.status).toBe('placed');
      expect(res.body.data.previousStatus).toBe('pending_confirmation');
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await waiterApi.patch(`/api/v1/orders/${fakeId}/confirm`);

      expect(res.status).toBe(404);
    });

    it('should return 400 when trying to confirm already confirmed order', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-confirm-dup-${Date.now()}`,
      );

      // First confirm
      await waiterApi.patch(`/api/v1/orders/${orderId}/confirm`);

      // Try to confirm again
      const res = await waiterApi.patch(`/api/v1/orders/${orderId}/confirm`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should return 403 for waiter from different outlet', async () => {
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

      const { orderId } = await createTestScenario(
        app,
        otherOutlet.id,
        item1Id,
        `test-other-${Date.now()}`,
      );

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/confirm`)
        .set('Cookie', waiterSession.cookie)
        .set('X-Outlet-Id', tenantA.outlet.id);

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-noauth-${Date.now()}`,
      );

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/confirm`)
        .set('X-Outlet-Id', tenantA.outlet.id);

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/orders/:id/reject', () => {
    it('should reject a pending order with reason as waiter', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-reject-${Date.now()}`,
      );

      const res = await waiterApi.patch(`/api/v1/orders/${orderId}/reject`, {
        reason: 'Item out of stock',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.id).toBe(orderId);
      expect(res.body.data.order.status).toBe('cancelled');
      expect(res.body.data.previousStatus).toBe('pending_confirmation');
    });

    it('should return 400 without rejection reason', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-reject-noreason-${Date.now()}`,
      );

      const res = await waiterApi.patch(`/api/v1/orders/${orderId}/reject`, {});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await waiterApi.patch(`/api/v1/orders/${fakeId}/reject`, { reason: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when trying to reject already confirmed order', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-reject-confirmed-${Date.now()}`,
      );

      // First confirm
      await waiterApi.patch(`/api/v1/orders/${orderId}/confirm`);

      // Try to reject
      const res = await waiterApi.patch(`/api/v1/orders/${orderId}/reject`, {
        reason: 'Changed mind',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should return 403 for waiter from different outlet', async () => {
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

      const { orderId } = await createTestScenario(
        app,
        otherOutlet.id,
        item1Id,
        `test-reject-other-${Date.now()}`,
      );

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/reject`)
        .send({ reason: 'Test' })
        .set('Cookie', waiterSession.cookie)
        .set('X-Outlet-Id', tenantA.outlet.id);

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-reject-noauth-${Date.now()}`,
      );

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/reject`)
        .send({ reason: 'Test' })
        .set('X-Outlet-Id', tenantA.outlet.id);

      expect(res.status).toBe(401);
    });

    it('should allow manager to reject order', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-reject-mgr-${Date.now()}`,
      );

      const managerSession = await createSession(tenantA.users.manager, tenantA.outlet.id);
      const managerApi = tenantApi(app, managerSession);

      const res = await managerApi.patch(`/api/v1/orders/${orderId}/reject`, {
        reason: 'Manager rejected',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe('cancelled');
    });

    it('should allow owner to reject order', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-reject-owner-${Date.now()}`,
      );

      const res = await ownerAApi.patch(`/api/v1/orders/${orderId}/reject`, {
        reason: 'Owner rejected',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe('cancelled');
    });
  });

  describe('Order status flow integration', () => {
    it('should track status from pending_confirmation -> placed -> preparing -> ready -> served -> completed', async () => {
      const { orderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-flow-${Date.now()}`,
      );

      // Waiter confirms
      const confirmRes = await waiterApi.patch(`/api/v1/orders/${orderId}/confirm`);
      expect(confirmRes.body.data.order.status).toBe('placed');

      // Kitchen moves to preparing
      const preparingRes = await kitchenApi.patch(`/api/v1/orders/${orderId}/status`, {
        status: 'preparing',
      });
      expect(preparingRes.body.data.order.status).toBe('preparing');

      // Kitchen moves to ready
      const readyRes = await kitchenApi.patch(`/api/v1/orders/${orderId}/status`, {
        status: 'ready',
      });
      expect(readyRes.body.data.order.status).toBe('ready');

      // Waiter moves to served
      const servedRes = await waiterApi.patch(`/api/v1/orders/${orderId}/status`, {
        status: 'served',
      });
      expect(servedRes.body.data.order.status).toBe('served');

      // Waiter moves to completed
      const completedRes = await waiterApi.patch(`/api/v1/orders/${orderId}/status`, {
        status: 'completed',
      });
      expect(completedRes.body.data.order.status).toBe('completed');
    });

    it('should list only pending_confirmation orders when filtered', async () => {
      // Create a pending order
      const { orderId: pendingOrderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-pending-${Date.now()}`,
      );

      // Create another order and confirm it
      const { orderId: confirmedOrderId } = await createTestScenario(
        app,
        tenantA.outlet.id,
        item1Id,
        `test-confirmed-${Date.now()}`,
      );

      await waiterApi.patch(`/api/v1/orders/${confirmedOrderId}/confirm`);

      const res = await waiterApi.get('/api/v1/orders?status=pending_confirmation&limit=20');

      expect(res.status).toBe(200);
      const pendingOrders = res.body.data;
      expect(pendingOrders.some((o: any) => o.id === pendingOrderId)).toBe(true);
      expect(pendingOrders.some((o: any) => o.id === confirmedOrderId)).toBe(false);
    });
  });
});
