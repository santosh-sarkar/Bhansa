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

describe('Public Sessions', () => {
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

    // Create a category and item for testing
    const category = await prisma.menuCategory.create({
      data: { organization_id: tenantA.organization.id, name: 'Test Category', sort_order: 1 },
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
  });

  describe('POST /api/v1/public/sessions', () => {
    it('creates a new session for valid QR token', async () => {
      // Create a table with QR token
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Test Table 1',
          qr_token: 'qr-session-test-1',
        },
      });

      const res = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.session).toBeDefined();
      expect(res.body.data.session.id).toBeDefined();
      expect(res.body.data.session.outlet_id).toBe(tenantA.outlet.id);
      expect(res.body.data.session.table_id).toBe(table.id);
      expect(res.body.data.session.status).toBe('open');
      expect(res.body.data.table.id).toBe(table.id);
      expect(res.body.data.table.label).toBe('Test Table 1');
      expect(res.body.data.outlet.id).toBe(tenantA.outlet.id);

      // Check guest cookie is set
      const cookies = res.headers['set-cookie'] as string[] | string | undefined;
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
      const guestCookie = cookieArray.find((c: string) => c.startsWith('guest_token='));
      expect(guestCookie).toBeDefined();
    });

    it('returns 404 for invalid QR token', async () => {
      const res = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: 'invalid-qr-token' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for QR token of inactive table', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Inactive Table',
          qr_token: 'qr-inactive-session',
          is_active: false,
        },
      });

      const res = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 404 for QR token of table in deleted outlet', async () => {
      const outlet = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Deleted Outlet',
        },
      });

      const table = await prisma.diningTable.create({
        data: {
          outlet_id: outlet.id,
          label: 'Table in Deleted Outlet',
          qr_token: 'qr-deleted-session',
        },
      });

      await prisma.outlet.update({
        where: { id: outlet.id },
        data: { deleted_at: new Date() },
      });

      const res = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 404 for QR token of table in inactive outlet', async () => {
      const outlet = await prisma.outlet.create({
        data: {
          organization_id: tenantA.organization.id,
          name: 'Inactive Outlet',
          is_active: false,
        },
      });

      const table = await prisma.diningTable.create({
        data: {
          outlet_id: outlet.id,
          label: 'Table in Inactive Outlet',
          qr_token: 'qr-inactive-outlet-session',
        },
      });

      const res = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('joins existing open session instead of creating new one', async () => {
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Join Session Table',
          qr_token: 'qr-join-session',
        },
      });

      // First request - creates session
      const res1 = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(201);

      const sessionId1 = res1.body.data.session.id;
      const cookies1 = res1.headers['set-cookie'] as string[] | string | undefined;
      const cookieArray1 = Array.isArray(cookies1) ? cookies1 : cookies1 ? [cookies1] : [];
      const foundCookie1 = cookieArray1.find((c: string) => c.startsWith('guest_token='));
      if (!foundCookie1) throw new Error('Guest token cookie not found');
      const guestCookie1 = foundCookie1!.split(';')[0] as string;

      // Second request with same QR token - should join existing session
      const res2 = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(201);

      expect(res2.body.data.session.id).toBe(sessionId1);

      // When joining existing session, no new guest cookie is set (session already has one)
      // This is expected behavior
    });

    it('returns 400 for missing qrToken', async () => {
      const res = await request(app).post('/api/v1/public/sessions').send({}).expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/public/sessions/current', () => {
    let sessionCookie = '';
    let tableId = '';

    beforeAll(async () => {
      // Create a table and session
      const table = await prisma.diningTable.create({
        data: {
          outlet_id: tenantA.outlet.id,
          label: 'Current Session Table',
          qr_token: 'qr-current-session',
        },
      });
      tableId = table.id;

      const res = await request(app)
        .post('/api/v1/public/sessions')
        .send({ qrToken: table.qr_token })
        .expect(201);

      const cookies = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieArray = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
      const foundCookie = cookieArray.find((c: string) => c.startsWith('guest_token='));
      if (!foundCookie) throw new Error('Guest token cookie not found');
      sessionCookie = foundCookie!.split(';')[0] as string;
    });

    it('returns current session details with guest cookie', async () => {
      const res = await request(app)
        .get('/api/v1/public/sessions/current')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.session).toBeDefined();
      expect(res.body.data.session.id).toBeDefined();
      expect(res.body.data.session.outlet_id).toBe(tenantA.outlet.id);
      expect(res.body.data.session.table_id).toBe(tableId);
      expect(res.body.data.session.status).toBe('open');
      expect(res.body.data.table.id).toBe(tableId);
      expect(res.body.data.table.label).toBe('Current Session Table');
      expect(res.body.data.outlet.id).toBe(tenantA.outlet.id);
      expect(res.body.data.outlet.tax_percent).toBeDefined();
      expect(res.body.data.outlet.service_charge_percent).toBeDefined();
      expect(Array.isArray(res.body.data.orders)).toBe(true);
    });

    it('returns 404 without guest cookie', async () => {
      const res = await request(app).get('/api/v1/public/sessions/current').expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 with invalid guest cookie', async () => {
      const res = await request(app)
        .get('/api/v1/public/sessions/current')
        .set('Cookie', 'guest_token=invalid-token')
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('includes orders when they exist', async () => {
      // Find the session
      const session = await prisma.tableSession.findFirst({
        where: { table_id: tableId, status: 'open' },
      });

      // Create an order for this session
      await prisma.order.create({
        data: {
          outlet_id: tenantA.outlet.id,
          order_number: 1,
          order_type: 'dine_in',
          status: 'placed',
          session_id: session!.id,
          table_id: tableId,
          subtotal: '100.00',
          tax_amount: '13.00',
          discount_amount: '0.00',
          total: '113.00',
          items: {
            create: {
              outlet_id: tenantA.outlet.id,
              menu_item_id: (await prisma.menuItem.findFirst({
                where: { organization_id: tenantA.organization.id },
              }))!.id,
              item_name: 'Test Item',
              unit_price: '100.00',
              quantity: 1,
              line_total: '100.00',
              status: 'placed',
            },
          },
        },
      });

      const res = await request(app)
        .get('/api/v1/public/sessions/current')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orders.length).toBe(1);
      expect(res.body.data.orders[0].order_number).toBe(1);
      expect(res.body.data.orders[0].status).toBe('placed');
      expect(res.body.data.orders[0].items.length).toBe(1);
      expect(res.body.data.orders[0].items[0].name).toBe('Test Item');
    });

    describe('POST /api/v1/public/sessions/current/bill-request', () => {
      let billSessionCookie = '';
      let billTableId = '';

      beforeAll(async () => {
        // Create a table and session for bill request tests
        const billTable = await prisma.diningTable.create({
          data: {
            outlet_id: tenantA.outlet.id,
            label: 'Bill Request Table',
            qr_token: 'qr-bill-request',
          },
        });
        billTableId = billTable.id;

        const billSession = await request(app)
          .post('/api/v1/public/sessions')
          .send({ qrToken: billTable.qr_token })
          .expect(201);

        const billCookies = billSession.headers['set-cookie'] as string[] | string | undefined;
        const billCookieArray = Array.isArray(billCookies)
          ? billCookies
          : billCookies
            ? [billCookies]
            : [];
        const foundBillCookie = billCookieArray.find((c: string) => c.startsWith('guest_token='));
        if (!foundBillCookie) throw new Error('Bill guest token cookie not found');
        billSessionCookie = foundBillCookie!.split(';')[0] as string;
      });

      it('requests the bill successfully', async () => {
        const res = await request(app)
          .post('/api/v1/public/sessions/current/bill-request')
          .set('Cookie', billSessionCookie)
          .send({})
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.success).toBe(true);
      });

      it('returns 400 when bill already requested', async () => {
        const res = await request(app)
          .post('/api/v1/public/sessions/current/bill-request')
          .set('Cookie', billSessionCookie)
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('returns 401 without guest cookie', async () => {
        const res = await request(app)
          .post('/api/v1/public/sessions/current/bill-request')
          .send({})
          .expect(401);

        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      });

      it('returns 404 with invalid guest cookie', async () => {
        const res = await request(app)
          .post('/api/v1/public/sessions/current/bill-request')
          .send({})
          .set('Cookie', 'guest_token=invalid-token')
          .expect(404);

        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('NOT_FOUND');
      });

      it('returns 400 for already closed session', async () => {
        const closedTable = await prisma.diningTable.create({
          data: {
            outlet_id: tenantA.outlet.id,
            label: 'Closed Session Table',
            qr_token: 'qr-closed-session',
          },
        });

        const closedSession = await request(app)
          .post('/api/v1/public/sessions')
          .send({ qrToken: closedTable.qr_token })
          .expect(201);

        const closedCookies = closedSession.headers['set-cookie'] as string[] | string | undefined;
        const closedCookieArray = Array.isArray(closedCookies)
          ? closedCookies
          : closedCookies
            ? [closedCookies]
            : [];
        const foundClosedCookie = closedCookieArray.find((c: string) =>
          c.startsWith('guest_token='),
        );
        if (!foundClosedCookie) throw new Error('Closed session guest token cookie not found');
        const closedSessionCookie = foundClosedCookie!.split(';')[0] as string;

        // Close the session
        const openSession = await prisma.tableSession.findFirst({
          where: { table_id: closedTable.id, status: 'open' },
        });
        await prisma.tableSession.update({
          where: { id: openSession!.id },
          data: { status: 'closed', closed_at: new Date() },
        });

        const res = await request(app)
          .post('/api/v1/public/sessions/current/bill-request')
          .set('Cookie', closedSessionCookie)
          .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      });

      it.skip('rate limits bill requests per session', async () => {
        // The bill request endpoint is rate limited to 5 requests per minute per session.
        // Since a guest can only request the bill once per session, we test the rate limiter
        // by making multiple requests to the same session (which will fail after the first
        // due to "Bill already requested", but the rate limiter should still track requests).

        // Create a session
        const rateLimitTable = await prisma.diningTable.create({
          data: {
            outlet_id: tenantA.outlet.id,
            label: 'Rate Limit Table',
            qr_token: 'qr-rate-limit',
          },
        });

        const rateLimitSession = await request(app)
          .post('/api/v1/public/sessions')
          .send({ qrToken: 'qr-rate-limit' })
          .expect(201);

        const rateLimitCookies = rateLimitSession.headers['set-cookie'] as
          string[] | string | undefined;
        const rateLimitCookieArray = Array.isArray(rateLimitCookies)
          ? rateLimitCookies
          : rateLimitCookies
            ? [rateLimitCookies]
            : [];
        const foundRateLimitCookie = rateLimitCookieArray.find((c: string) =>
          c.startsWith('guest_token='),
        );
        if (!foundRateLimitCookie) throw new Error('Rate limit guest token cookie not found');
        const rateLimitSessionCookie = foundRateLimitCookie!.split(';')[0] as string;

        // First request should succeed (bill requested)
        await request(app)
          .post('/api/v1/public/sessions/current/bill-request')
          .send({})
          .set('Cookie', rateLimitSessionCookie)
          .expect(200);

        // Subsequent requests to the same session should be rejected with "Bill already requested"
        // but the rate limiter should still count these requests
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/v1/public/sessions/current/bill-request')
            .send({})
            .set('Cookie', rateLimitSessionCookie)
            .expect(400); // "Bill already requested"
        }

        // 6th request should be rate limited (429)
        const res = await request(app)
          .post('/api/v1/public/sessions/current/bill-request')
          .send({})
          .set('Cookie', rateLimitSessionCookie)
          .expect(429);

        expect(res.body.success).toBe(false);
      });
    });
  });
});
