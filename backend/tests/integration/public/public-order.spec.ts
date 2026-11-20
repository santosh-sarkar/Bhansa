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

describe('Public Orders', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;

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
    ownerAApi = tenantApi(app, ownerASession);

    // Create a category and items for testing
    const category = await prisma.menuCategory.create({
      data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
    });

    await prisma.menuItem.createMany({
      data: [
        {
          organization_id: tenantA.organization.id,
          category_id: category.id,
          name: 'Test Item 1',
          base_price: '100.00',
          is_active: true,
        },
        {
          organization_id: tenantA.organization.id,
          category_id: category.id,
          name: 'Test Item 2',
          base_price: '200.00',
          is_active: true,
        },
        {
          organization_id: tenantA.organization.id,
          category_id: category.id,
          name: 'Inactive Item',
          base_price: '50.00',
          is_active: false,
        },
      ],
    });
  });

  describe('POST /api/v1/public/orders', () => {
    let sessionCookie: string;
    let tableId: string;
    let item1Id: string;
    let item2Id: string;

    beforeAll(async () => {
      // Create a table and session
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Order Test Table',
          qr_token: 'qr-order-test',
        },
      });
      tableId = table.id;

      const res = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(201);

      const cookies = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieArray = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
      sessionCookie = cookieArray.find((c: string) => c.startsWith('guest_token='))!;

      // Get item IDs
      const items = await prisma.menuItem.findMany({
        where: { organization_id: tenantA.organization.id, is_active: true },
        select: { id: true, name: true },
      });
      item1Id = items.find((i) => i.name === 'Test Item 1')!.id;
      item2Id = items.find((i) => i.name === 'Test Item 2')!.id;
    });

    it('creates an order with valid items', async () => {
      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          items: [
            { menuItemId: item1Id, quantity: 2 },
            { menuItemId: item2Id, quantity: 1 },
          ],
          idempotencyKey: 'test-idempotency-1',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.order.id).toBeDefined();
      expect(res.body.data.order.order_number).toBe(1);
      expect(res.body.data.order.status).toBe('pending_confirmation');
      expect(res.body.data.order.items.length).toBe(2);
      expect(res.body.data.session.id).toBeDefined();
      expect(res.body.data.session.table_id).toBe(tableId);
      expect(res.body.data.session.outlet_id).toBe(tenantA.outlet.id);

      // Check pricing
      const item1 = res.body.data.order.items.find(
        (i: { name: string }) => i.name === 'Test Item 1',
      );
      const item2 = res.body.data.order.items.find(
        (i: { name: string }) => i.name === 'Test Item 2',
      );
      expect(item1.quantity).toBe(2);
      expect(item1.unit_price).toBe('100.00');
      expect(item2.quantity).toBe(1);
      expect(item2.unit_price).toBe('200.00');

      // Check totals: subtotal = 2*100 + 1*200 = 400
      // tax = 400 * 13% = 52
      // service = 400 * 10% = 40
      // total = 400 + 52 + 40 = 492
      expect(res.body.data.order.subtotal).toBe('400.00');
      expect(res.body.data.order.tax_amount).toBe('52.00');
      expect(res.body.data.order.total).toBe('492.00');
    });

    it('returns 401 without guest cookie', async () => {
      const res = await request(app)
        .post('/api/v1/public/orders')
        .send({
          items: [{ menuItemId: item1Id, quantity: 1 }],
          idempotencyKey: 'test-idempotency-2',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 401 with invalid guest cookie', async () => {
      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', 'guest_token=invalid-token')
        .send({
          items: [{ menuItemId: item1Id, quantity: 1 }],
          idempotencyKey: 'test-idempotency-3',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('returns 404 for session that is not open', async () => {
      // Create a table and session, then close it
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Closed Session Table',
          qr_token: 'qr-closed-session',
        },
      });

      const session = await prisma.tableSession.create({
        data: {
          outlet_id: tenantA.outlet.id,
          table_id: table.id,
          guest_token: 'hashed-token',
          status: 'closed',
        },
      });

      // Manually set a cookie for this closed session
      const { hashToken } = await import('@/utils/token');
      const guestToken = 'test-token-closed';
      const guestTokenHash = hashToken(guestToken);
      await prisma.tableSession.update({
        where: { id: session.id },
        data: { guest_token: guestTokenHash },
      });

      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', `guest_token=${guestToken}`)
        .send({
          items: [{ menuItemId: item1Id, quantity: 1 }],
          idempotencyKey: 'test-idempotency-4',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for inactive menu item', async () => {
      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          items: [
            { menuItemId: item1Id, quantity: 1 },
            {
              menuItemId: (await prisma.menuItem.findFirst({ where: { name: 'Inactive Item' } }))!
                .id,
              quantity: 1,
            },
          ],
          idempotencyKey: 'test-idempotency-5',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for non-existent menu item', async () => {
      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          items: [{ menuItemId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
          idempotencyKey: 'test-idempotency-6',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for missing idempotency key', async () => {
      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          items: [{ menuItemId: item1Id, quantity: 1 }],
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing items', async () => {
      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          idempotencyKey: 'test-idempotency-7',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid quantity', async () => {
      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          items: [{ menuItemId: item1Id, quantity: 0 }],
          idempotencyKey: 'test-idempotency-8',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 for duplicate idempotency key', async () => {
      // First request
      await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          items: [{ menuItemId: item1Id, quantity: 1 }],
          idempotencyKey: 'test-duplicate-key',
        })
        .expect(201);

      // Second request with same idempotency key
      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          items: [{ menuItemId: item1Id, quantity: 1 }],
          idempotencyKey: 'test-duplicate-key',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('includes options in order items', async () => {
      // Create an option for item1
      const option = await prisma.menuItemOption.create({
        data: {
          menu_item_id: item1Id,
          kind: 'addon',
          name: 'Extra Cheese',
          price_delta: '20.00',
          is_active: true,
        },
      });

      const res = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          items: [
            {
              menuItemId: item1Id,
              quantity: 1,
              options: [{ optionId: option.id, quantity: 1 }],
            },
          ],
          idempotencyKey: 'test-idempotency-options',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const item = res.body.data.order.items[0];
      expect(item.options).toBeDefined();
      expect(item.options.length).toBe(1);
      expect(item.options[0].optionId).toBe(option.id);
      expect(item.options[0].quantity).toBe(1);
    });
  });

  describe('GET /api/v1/public/orders/:id', () => {
    let sessionCookie: string;
    let orderId: string;
    let tableId: string;
    let itemId: string;

    beforeAll(async () => {
      // Create a table and session
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Get Order Test Table',
          qr_token: 'qr-get-order-test',
        },
      });
      tableId = table.id;

      const res = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(201);

      const cookies = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieArray = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
      sessionCookie = cookieArray.find((c: string) => c.startsWith('guest_token='))!;

      // Get item ID
      const item = await prisma.menuItem.findFirst({
        where: { organization_id: tenantA.organization.id, is_active: true },
        select: { id: true },
      });
      itemId = item!.id;

      // Create an order
      const orderRes = await request(app)
        .post('/api/v1/public/orders')
        .set('Cookie', sessionCookie)
        .send({
          items: [{ menuItemId: itemId, quantity: 2 }],
          idempotencyKey: 'test-get-order-idempotency',
        })
        .expect(201);

      orderId = orderRes.body.data.order.id;
    });

    it('returns order details for valid order', async () => {
      const res = await request(app)
        .get(`/api/v1/public/orders/${orderId}`)
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.order.id).toBe(orderId);
      expect(res.body.data.order.order_number).toBeDefined();
      expect(res.body.data.order.status).toBe('pending_confirmation');
      expect(res.body.data.order.items.length).toBe(1);
      expect(res.body.data.order.items[0].quantity).toBe(2);
    });

    it('returns 401 without guest cookie', async () => {
      const res = await request(app).get(`/api/v1/public/orders/${orderId}`).expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 404 for non-existent order', async () => {
      const res = await request(app)
        .get('/api/v1/public/orders/00000000-0000-0000-0000-000000000000')
        .set('Cookie', sessionCookie)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for order from different session', async () => {
      // Create another table and session for tenantA
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Other Session Table',
          qr_token: 'qr-other-session',
        },
      });

      const sessionRes = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(201);

      const cookies = sessionRes.headers['set-cookie'] as string[] | string | undefined;
      const cookieArray = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
      const otherSessionCookie = cookieArray.find((c: string) => c.startsWith('guest_token='))!;

      // Try to access the first order with the second session's cookie
      const getRes = await request(app)
        .get(`/api/v1/public/orders/${orderId}`)
        .set('Cookie', otherSessionCookie)
        .expect(404);

      expect(getRes.body.success).toBe(false);
      expect(getRes.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for order from different tenant', async () => {
      // Create a session for tenantB
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantB.outlet.id,
          label: 'Tenant B Table',
          qr_token: 'qr-tenant-b-order',
        },
      });

      const sessionRes2 = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(201);

      const cookies2 = sessionRes2.headers['set-cookie'] as string[] | string | undefined;
      const cookieArray2 = Array.isArray(cookies2) ? cookies2 : cookies2 ? [cookies2] : [];
      const tenantBSessionCookie = cookieArray2.find((c: string) => c.startsWith('guest_token='))!;

      // Try to access the first order with tenantB's session cookie
      const getRes2 = await request(app)
        .get(`/api/v1/public/orders/${orderId}`)
        .set('Cookie', tenantBSessionCookie)
        .expect(404);

      expect(getRes2.body.success).toBe(false);
      expect(getRes2.body.error.code).toBe('NOT_FOUND');
    });
  });
});
