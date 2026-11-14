import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { resetDatabase } from '../../helpers/database';
import {
  createIsolatedTenants,
  createSession,
  tenantApi,
  type TestTenant,
  type TenantSession,
  type TenantApi,
} from '../../helpers/tenant';

const app = createApp();

describe('POST /api/v1/subscription/custom-plan-request', () => {
  let tenant: TestTenant;
  let ownerSession: TenantSession;
  let ownerApi: TenantApi;
  let outletId: string;

  beforeAll(async () => {
    await resetDatabase();
    const { tenantA: t } = await createIsolatedTenants();
    tenant = t;
    outletId = tenant.outlet.id;

    ownerSession = await createSession(tenant.users.owner, tenant.outlet.id);
    ownerApi = tenantApi(app, ownerSession);
  });

  it('creates a custom plan lead with valid data', async () => {
    const res = await ownerApi.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: 'John Doe',
      contact_email: 'john@example.com',
      outlet_count: 5,
      message: 'We need a multi-outlet solution for our restaurant chain.',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lead).toMatchObject({
      contact_name: 'John Doe',
      contact_email: 'john@example.com',
      outlet_count: 5,
      message: 'We need a multi-outlet solution for our restaurant chain.',
      handled: false,
    });
    expect(res.body.data.lead.id).toBeDefined();
    expect(res.body.data.lead.created_at).toBeDefined();
  });

  it('creates a custom plan lead with only required fields', async () => {
    const res = await ownerApi.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: 'Jane Smith',
      contact_email: 'jane@example.com',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lead.outlet_count).toBeNull();
    expect(res.body.data.lead.message).toBeNull();
  });

  it('rejects requests without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/plans/subscription/custom-plan-request')
      .set('X-Outlet-Id', outletId)
      .send({
        contact_name: 'Test User',
        contact_email: 'test@example.com',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects requests without X-Outlet-Id header', async () => {
    const sessionWithoutOutlet = await createSession(tenant.users.owner, '');
    const apiWithoutOutlet = tenantApi(app, sessionWithoutOutlet);
    const res = await apiWithoutOutlet.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: 'Test User',
      contact_email: 'test@example.com',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid contact_email', async () => {
    const res = await ownerApi.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: 'Test User',
      contact_email: 'not-an-email',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects empty contact_name', async () => {
    const res = await ownerApi.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: '',
      contact_email: 'test@example.com',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects contact_name longer than 100 characters', async () => {
    const res = await ownerApi.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: 'a'.repeat(101),
      contact_email: 'test@example.com',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects message longer than 2000 characters', async () => {
    const res = await ownerApi.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: 'Test User',
      contact_email: 'test@example.com',
      message: 'a'.repeat(2001),
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects outlet_count less than 1', async () => {
    const res = await ownerApi.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: 'Test User',
      contact_email: 'test@example.com',
      outlet_count: 0,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects outlet_count greater than 100', async () => {
    const res = await ownerApi.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: 'Test User',
      contact_email: 'test@example.com',
      outlet_count: 101,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('stores lead in database with correct organization_id', async () => {
    const res = await ownerApi.post('/api/v1/plans/subscription/custom-plan-request', {
      contact_name: 'DB Test User',
      contact_email: 'dbtest@example.com',
      outlet_count: 3,
      message: 'Test message for DB',
    });

    expect(res.status).toBe(201);

    const lead = await prisma.customPlanLead.findUnique({
      where: { id: res.body.data.lead.id },
    });

    expect(lead).not.toBeNull();
    expect(lead!.organization_id).toBe(tenant.organization.id);
    expect(lead!.contact_name).toBe('DB Test User');
    expect(lead!.contact_email).toBe('dbtest@example.com');
    expect(lead!.outlet_count).toBe(3);
    expect(lead!.message).toBe('Test message for DB');
    expect(lead!.handled).toBe(false);
  });
});
