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

// Helper to create a staff order for a table
async function createStaffOrder(
  api: TenantApi,
  tableId: string,
  itemId: string,
  idempotencyKey: string,
  options?: Array<{ optionId: string; quantity: number }>,
) {
  const res = await api.post('/api/v1/orders', {
    table_id: tableId,
    items: [{ menuItemId: itemId, quantity: 1, options }],
    notes: `Test order ${idempotencyKey}`,
  });
  return res;
}

// Helper to create a public order (stays in pending_confirmation)
async function createPendingOrder(
  appInstance: ReturnType<typeof createApp>,
  outletId: string,
  itemId: string,
  idempotencyKey: string,
): Promise<{ orderId: string; guestToken: string; tableId: string }> {
  const table = await prisma.diningTable.create({
    data: {
      outlet_id: outletId,
      label: `Cancel Test Table ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      seats: 4,
      qr_token: `qr-cancel-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      is_active: true,
    },
  });

  const guestSession = await request(appInstance)
    .post('/api/v1/public/sessions')
    .send({ qrToken: table.qr_token });

  const guestCookie = guestSession.headers['set-cookie']?.[0];
  if (!guestCookie) throw new Error('No guest cookie received');
  const firstPart = guestCookie.split(';')[0];
  if (!firstPart) throw new Error('Invalid cookie format');
  const parts = firstPart.split('=');
  if (parts.length < 2) throw new Error('No guest token in cookie');
  const guestToken = parts[1] as string;

  const orderRes = await request(appInstance)
    .post('/api/v1/public/orders')
    .set('Cookie', `guest_token=${guestToken}`)
    .send({
      idempotencyKey,
      items: [{ menuItemId: itemId, quantity: 1 }],
    });

  return { orderId: orderRes.body.data.order.id, guestToken, tableId: table.id };
}

// Helper to create a table
async function createTestTable(outletId: string) {
  return prisma.diningTable.create({
    data: {
      outlet_id: outletId,
      label: `Cancel Test Table ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      seats: 4,
      qr_token: `qr-cancel-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      is_active: true,
    },
  });
}

// Helper to confirm an order as waiter
async function confirmOrder(api: TenantApi, orderId: string) {
  return api.patch(`/api/v1/orders/${orderId}/confirm`);
}

// Helper to move order to preparing as kitchen
async function prepareOrder(api: TenantApi, orderId: string) {
  return api.patch(`/api/v1/orders/${orderId}/status`, { status: 'preparing' });
}

// Helper to move order to ready as kitchen
async function readyOrder(api: TenantApi, orderId: string) {
  return api.patch(`/api/v1/orders/${orderId}/status`, { status: 'ready' });
}

// Helper to move order to served as waiter
async function serveOrder(api: TenantApi, orderId: string) {
  return api.patch(`/api/v1/orders/${orderId}/status`, { status: 'served' });
}

// Helper to move order to completed as waiter
async function completeOrder(api: TenantApi, orderId: string) {
  return api.patch(`/api/v1/orders/${orderId}/status`, { status: 'completed' });
}

describe('Order Cancellation with Reason and Permission Rules (PD-008)', () => {
  let tenantA: TestTenant;
  let waiterSession: TenantSession;
  let waiterApi: TenantApi;
  let kitchenSession: TenantSession;
  let kitchenApi: TenantApi;
  let managerSession: TenantSession;
  let managerApi: TenantApi;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
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

    managerSession = await createSession(tenantA.users.manager, tenantA.outlet.id);
    managerApi = tenantApi(app, managerSession);

    ownerASession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    ownerAApi = tenantApi(app, ownerASession);

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

    const table = await createTestTable(tenantA.outlet.id);
    tableId = table.id;
  });

  async function createPendingStaffOrder(
    api: TenantApi,
    itemId: string,
    idempotencyKey: string,
    tableIdParam?: string,
  ) {
    const res = await api.post('/api/v1/orders', {
      table_id: tableIdParam ?? tableId,
      items: [{ menuItemId: itemId, quantity: 1 }],
      notes: `Test ${idempotencyKey}`,
    });
    return { orderId: res.body.data.order.id };
  }

  describe('POST /api/v1/orders/:id/cancel (PD-008 rules)', () => {
    describe('Before preparing (pending_confirmation, placed) - anyone with order.cancel can cancel, stock restored', () => {
      it('should cancel pending_confirmation order as waiter', async () => {
        // Create a public order (stays in pending_confirmation)
        const { orderId } = await createPendingOrder(
          app,
          tenantA.outlet.id,
          item1Id,
          `cancel-pending-${Date.now()}`,
        );

        const res = await waiterApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Customer changed mind',
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.order.status).toBe('cancelled');
        expect(res.body.data.previousStatus).toBe('pending_confirmation');
      });

      it('should cancel placed order as waiter', async () => {
        const { orderId } = await createPendingStaffOrder(
          waiterApi,
          item1Id,
          `cancel-placed-${Date.now()}`,
        );

        await confirmOrder(waiterApi, orderId);

        const res = await waiterApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Customer left',
        });

        expect(res.status).toBe(200);
        expect(res.body.data.order.status).toBe('cancelled');
        expect(res.body.data.previousStatus).toBe('placed');
      });

      it('should cancel placed order as kitchen', async () => {
        const { orderId } = await createPendingStaffOrder(
          kitchenApi,
          item1Id,
          `cancel-placed-kitchen-${Date.now()}`,
        );

        await confirmOrder(kitchenApi, orderId);

        const res = await kitchenApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Kitchen cancelled',
        });

        expect(res.status).toBe(200);
        expect(res.body.data.order.status).toBe('cancelled');
      });
    });

    describe('At preparing - only manager/owner can cancel, stock NOT restored', () => {
      it('should allow manager to cancel preparing order', async () => {
        const { orderId } = await createPendingStaffOrder(
          managerApi,
          item1Id,
          `cancel-preparing-mgr-${Date.now()}`,
        );

        await confirmOrder(managerApi, orderId);
        await prepareOrder(kitchenApi, orderId);

        const res = await managerApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Manager decision',
        });

        expect(res.status).toBe(200);
        expect(res.body.data.order.status).toBe('cancelled');
      });

      it('should allow owner to cancel preparing order', async () => {
        const { orderId } = await createPendingStaffOrder(
          ownerAApi,
          item1Id,
          `cancel-preparing-owner-${Date.now()}`,
        );

        await confirmOrder(ownerAApi, orderId);
        await prepareOrder(kitchenApi, orderId);

        const res = await ownerAApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Owner decision',
        });

        expect(res.status).toBe(200);
        expect(res.body.data.order.status).toBe('cancelled');
      });

      it('should forbid waiter from cancelling preparing order', async () => {
        const { orderId } = await createPendingStaffOrder(
          waiterApi,
          item1Id,
          `cancel-preparing-waiter-${Date.now()}`,
        );

        await confirmOrder(waiterApi, orderId);
        await prepareOrder(kitchenApi, orderId);

        const res = await waiterApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Waiter tries to cancel',
        });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should forbid kitchen from cancelling preparing order', async () => {
        const { orderId } = await createPendingStaffOrder(
          kitchenApi,
          item1Id,
          `cancel-preparing-kitchen-${Date.now()}`,
        );

        await confirmOrder(kitchenApi, orderId);
        await prepareOrder(kitchenApi, orderId);

        const res = await kitchenApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Kitchen tries to cancel',
        });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('After preparing (ready, served) - only owner can cancel, stock NOT restored', () => {
      it('should allow owner to cancel ready order', async () => {
        const { orderId } = await createPendingStaffOrder(
          ownerAApi,
          item1Id,
          `cancel-ready-owner-${Date.now()}`,
        );

        await confirmOrder(ownerAApi, orderId);
        await prepareOrder(kitchenApi, orderId);
        await readyOrder(kitchenApi, orderId);

        const res = await ownerAApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Owner cancels ready',
        });

        expect(res.status).toBe(200);
        expect(res.body.data.order.status).toBe('cancelled');
      });

      it('should forbid waiter from cancelling ready order', async () => {
        const { orderId } = await createPendingStaffOrder(
          waiterApi,
          item1Id,
          `cancel-ready-waiter-${Date.now()}`,
        );

        await confirmOrder(waiterApi, orderId);
        await prepareOrder(kitchenApi, orderId);
        await readyOrder(kitchenApi, orderId);

        const res = await waiterApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Waiter tries',
        });

        expect(res.status).toBe(403);
      });

      it('should forbid manager from cancelling ready order', async () => {
        const { orderId } = await createPendingStaffOrder(
          managerApi,
          item1Id,
          `cancel-ready-mgr-${Date.now()}`,
        );

        await confirmOrder(managerApi, orderId);
        await prepareOrder(kitchenApi, orderId);
        await readyOrder(kitchenApi, orderId);

        const res = await managerApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Manager tries',
        });

        expect(res.status).toBe(403);
      });

      it('should allow owner to cancel served order', async () => {
        const { orderId } = await createPendingStaffOrder(
          ownerAApi,
          item1Id,
          `cancel-served-owner-${Date.now()}`,
        );

        await confirmOrder(ownerAApi, orderId);
        await prepareOrder(kitchenApi, orderId);
        await readyOrder(kitchenApi, orderId);
        await serveOrder(ownerAApi, orderId);

        const res = await ownerAApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Owner cancels served',
        });

        expect(res.status).toBe(200);
        expect(res.body.data.order.status).toBe('cancelled');
      });

      it('should forbid waiter from cancelling served order', async () => {
        const { orderId } = await createPendingStaffOrder(
          waiterApi,
          item1Id,
          `cancel-served-waiter-${Date.now()}`,
        );

        await confirmOrder(waiterApi, orderId);
        await prepareOrder(kitchenApi, orderId);
        await readyOrder(kitchenApi, orderId);
        await serveOrder(waiterApi, orderId);

        const res = await waiterApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Waiter tries',
        });

        expect(res.status).toBe(403);
      });

      it('should forbid manager from cancelling served order', async () => {
        const { orderId } = await createPendingStaffOrder(
          managerApi,
          item1Id,
          `cancel-served-mgr-${Date.now()}`,
        );

        await confirmOrder(managerApi, orderId);
        await prepareOrder(kitchenApi, orderId);
        await readyOrder(kitchenApi, orderId);
        await serveOrder(managerApi, orderId);

        const res = await managerApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Manager tries',
        });

        expect(res.status).toBe(403);
      });
    });

    describe('Completed order cannot be cancelled', () => {
      it('should reject cancellation of completed order for all roles', async () => {
        const { orderId } = await createPendingStaffOrder(
          ownerAApi,
          item1Id,
          `cancel-completed-${Date.now()}`,
        );

        await confirmOrder(ownerAApi, orderId);
        await prepareOrder(kitchenApi, orderId);
        await readyOrder(kitchenApi, orderId);
        await serveOrder(ownerAApi, orderId);
        await completeOrder(ownerAApi, orderId);

        // Try as owner
        const ownerRes = await ownerAApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Owner tries completed',
        });
        expect(ownerRes.status).toBe(400);
        expect(ownerRes.body.error.code).toBe('INVALID_STATE_TRANSITION');

        // Try as manager
        const mgrRes = await managerApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Manager tries completed',
        });
        expect(mgrRes.status).toBe(400);

        // Try as waiter
        const waiterRes = await waiterApi.patch(`/api/v1/orders/${orderId}/cancel`, {
          reason: 'Waiter tries completed',
        });
        expect(waiterRes.status).toBe(400);
      });
    });

    describe('Validation and edge cases', () => {
      it('should require cancellation reason', async () => {
        const { orderId } = await createPendingStaffOrder(
          waiterApi,
          item1Id,
          `cancel-no-reason-${Date.now()}`,
        );

        const res = await waiterApi.patch(`/api/v1/orders/${orderId}/cancel`, {});

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return 404 for non-existent order', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const res = await waiterApi.patch(`/api/v1/orders/${fakeId}/cancel`, { reason: 'Test' });

        expect(res.status).toBe(404);
      });

      it('should return 401 without authentication', async () => {
        const { orderId } = await createPendingStaffOrder(
          waiterApi,
          item1Id,
          `cancel-noauth-${Date.now()}`,
        );

        const res = await request(app)
          .patch(`/api/v1/orders/${orderId}/cancel`)
          .send({ reason: 'Test' })
          .set('X-Outlet-Id', tenantA.outlet.id);

        expect(res.status).toBe(401);
      });

      it('should allow waiter to cancel order in another outlet of same organization', async () => {
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

        // Get waiter role ID
        const waiterRole = await prisma.role.findUnique({ where: { code: 'waiter' } });
        if (!waiterRole) throw new Error('Waiter role not found');

        // Assign waiter to the other outlet
        await prisma.staffAssignment.create({
          data: {
            user_id: tenantA.users.waiter.id,
            role_id: waiterRole.id,
            outlet_id: otherOutlet.id,
          },
        });

        // Create a table in the other outlet
        const otherTable = await createTestTable(otherOutlet.id);

        // Create a staff order in the other outlet using the other outlet's context
        const otherOutletApi = tenantApi(
          app,
          await createSession(tenantA.users.waiter, otherOutlet.id),
        );
        const { orderId } = await createPendingStaffOrder(
          otherOutletApi,
          item1Id,
          `cancel-other-outlet-${Date.now()}`,
          otherTable.id,
        );

        // Cancel from the original outlet (should succeed since permission is org-wide)
        const res = await request(app)
          .patch(`/api/v1/orders/${orderId}/cancel`)
          .send({ reason: 'Test' })
          .set('Cookie', waiterSession.cookie)
          .set('X-Outlet-Id', tenantA.outlet.id);

        expect(res.status).toBe(200);
        expect(res.body.data.order.status).toBe('cancelled');
      });
    });

    describe('Stock restoration verification', () => {
      it('should restore stock when cancelling before preparing', async () => {
        // Create an item with recipe for stock tracking
        const ingredient = await prisma.ingredient.create({
          data: {
            organization_id: tenantA.organization.id,
            name: 'Test Ingredient',
            unit: 'kg',
          },
        });

        await prisma.recipeItem.create({
          data: {
            menu_item_id: item1Id,
            ingredient_id: ingredient.id,
            quantity: 0.1,
          },
        });

        // Create initial stock
        await prisma.outletStock.create({
          data: {
            outlet_id: tenantA.outlet.id,
            ingredient_id: ingredient.id,
            quantity: 100,
          },
        });

        const { orderId } = await createPendingStaffOrder(
          waiterApi,
          item1Id,
          `cancel-stock-${Date.now()}`,
        );

        // Get stock before
        const stockBefore = await prisma.outletStock.findUnique({
          where: {
            outlet_id_ingredient_id: { outlet_id: tenantA.outlet.id, ingredient_id: ingredient.id },
          },
        });

        await confirmOrder(waiterApi, orderId);
        await waiterApi.patch(`/api/v1/orders/${orderId}/cancel`, { reason: 'Test stock restore' });

        // Get stock after
        const stockAfter = await prisma.outletStock.findUnique({
          where: {
            outlet_id_ingredient_id: { outlet_id: tenantA.outlet.id, ingredient_id: ingredient.id },
          },
        });

        // Stock should be restored (quantity increased by 0.1 * 1 = 0.1)
        expect(Number(stockAfter?.quantity)).toBe(Number(stockBefore?.quantity) + 0.1);

        // Check stock movement was recorded
        const movement = await prisma.stockMovement.findFirst({
          where: {
            outlet_id: tenantA.outlet.id,
            ingredient_id: ingredient.id,
            type: 'order_restore',
          },
          orderBy: { created_at: 'desc' },
        });
        expect(movement).toBeDefined();
        expect(movement?.reason).toContain('Stock restored from cancelled order');
      });
    });
  });
});
