import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import {
  createOrganization,
  createOutlet,
  createUser,
  createStaffAssignment,
} from '../../helpers/factories';
import {
  createIsolatedTenants,
  createSession,
  tenantApi,
  type TenantSession,
  type TestTenant,
} from '../../helpers/tenant';

const app = createApp();

describe('subscription guard middleware', () => {
  let tenant: TestTenant;
  let ownerSession: TenantSession;
  let ownerApi: ReturnType<typeof tenantApi>;

  beforeAll(async () => {
    const { tenantA: t } = await createIsolatedTenants();
    tenant = t;

    // Create a trial subscription for the active tenant
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
    await prisma.subscription.create({
      data: {
        organization_id: tenant.organization.id,
        plan_id: plan.id,
        status: 'trialing',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    ownerSession = await createSession(tenant.users.owner, tenant.outlet.id);
    ownerApi = tenantApi(app, ownerSession);
  });

  describe('active subscription (trialing)', () => {
    it('allows GET requests', async () => {
      const response = await ownerApi.get('/api/v1/staff?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('allows POST requests (mutations)', async () => {
      const response = await ownerApi.post('/api/v1/staff/invitations', {
        email: 'new-waiter@example.com',
        role: 'waiter',
      });

      expect(response.status).toBe(201);
    });

    it('allows PATCH requests', async () => {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: 'waiter' } });
      const user = await createUser(tenant.organization.id, {
        email: 'patch-test@example.com',
        full_name: 'Patch Test',
        email_verified_at: new Date(),
      });
      await createStaffAssignment({ userId: user.id, roleCode: 'waiter' });

      const response = await ownerApi.patch(`/api/v1/staff/${user.id}/role`, {
        role: 'kitchen',
      });

      expect(response.status).toBe(200);
    });

    it('allows PUT requests', async () => {
      const response = await ownerApi.put('/api/v1/staff/invalid-id/assignments', {
        outlet_ids: [],
      });

      // Should get past subscription guard (404 or 400 from downstream)
      expect(response.status).not.toBe(403);
    });

    it('allows DELETE requests', async () => {
      const response = await ownerApi.delete('/api/v1/staff/invitations/invalid-id');

      // Should get past subscription guard (404 from downstream)
      expect(response.status).not.toBe(403);
    });
  });

  describe('grace period subscription', () => {
    let graceTenant: TestTenant;
    let graceSession: TenantSession;
    let graceApi: ReturnType<typeof tenantApi>;

    beforeAll(async () => {
      const { tenantA: t } = await createIsolatedTenants();
      graceTenant = t;

      // Create a subscription in grace status
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
      await prisma.subscription.create({
        data: {
          organization_id: graceTenant.organization.id,
          plan_id: plan.id,
          status: 'grace',
          grace_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      graceSession = await createSession(graceTenant.users.owner, graceTenant.outlet.id);
      graceApi = tenantApi(app, graceSession);
    });

    it('allows GET requests in grace', async () => {
      const response = await graceApi.get('/api/v1/staff?limit=10');

      expect(response.status).toBe(200);
    });

    it('blocks POST requests in grace', async () => {
      const response = await graceApi.post('/api/v1/staff/invitations', {
        email: 'grace-waiter@example.com',
        role: 'waiter',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('SUBSCRIPTION_READ_ONLY');
    });

    it('blocks PATCH requests in grace', async () => {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: 'waiter' } });
      const user = await createUser(graceTenant.organization.id, {
        email: 'grace-patch@example.com',
        full_name: 'Grace Patch',
        email_verified_at: new Date(),
      });
      await createStaffAssignment({ userId: user.id, roleCode: 'waiter' });

      const response = await graceApi.patch(`/api/v1/staff/${user.id}/role`, {
        role: 'kitchen',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('SUBSCRIPTION_READ_ONLY');
    });

    it('blocks PUT requests in grace', async () => {
      const response = await graceApi.put('/api/v1/staff/invalid-id/assignments', {
        outlet_ids: [],
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('SUBSCRIPTION_READ_ONLY');
    });

    it('blocks DELETE requests in grace', async () => {
      const response = await graceApi.delete('/api/v1/staff/invitations/invalid-id');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('SUBSCRIPTION_READ_ONLY');
    });
  });

  describe('suspended subscription', () => {
    let suspendedTenant: TestTenant;
    let suspendedSession: TenantSession;
    let suspendedApi: ReturnType<typeof tenantApi>;

    beforeAll(async () => {
      const { tenantA: t } = await createIsolatedTenants();
      suspendedTenant = t;

      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
      await prisma.subscription.create({
        data: {
          organization_id: suspendedTenant.organization.id,
          plan_id: plan.id,
          status: 'suspended',
        },
      });

      suspendedSession = await createSession(
        suspendedTenant.users.owner,
        suspendedTenant.outlet.id,
      );
      suspendedApi = tenantApi(app, suspendedSession);
    });

    it('blocks GET requests when suspended', async () => {
      const response = await suspendedApi.get('/api/v1/staff?limit=10');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('SUBSCRIPTION_SUSPENDED');
    });

    it('blocks POST requests when suspended', async () => {
      const response = await suspendedApi.post('/api/v1/staff/invitations', {
        email: 'suspended-waiter@example.com',
        role: 'waiter',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('SUBSCRIPTION_SUSPENDED');
    });
  });

  describe('cancelled subscription', () => {
    let cancelledTenant: TestTenant;
    let cancelledSession: TenantSession;
    let cancelledApi: ReturnType<typeof tenantApi>;

    beforeAll(async () => {
      const { tenantA: t } = await createIsolatedTenants();
      cancelledTenant = t;

      const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
      await prisma.subscription.create({
        data: {
          organization_id: cancelledTenant.organization.id,
          plan_id: plan.id,
          status: 'cancelled',
        },
      });

      cancelledSession = await createSession(
        cancelledTenant.users.owner,
        cancelledTenant.outlet.id,
      );
      cancelledApi = tenantApi(app, cancelledSession);
    });

    it('blocks all requests when cancelled', async () => {
      const response = await cancelledApi.get('/api/v1/staff?limit=10');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('SUBSCRIPTION_SUSPENDED');
    });
  });

  describe('no active subscription', () => {
    let noSubTenant: TestTenant;
    let noSubSession: TenantSession;
    let noSubApi: ReturnType<typeof tenantApi>;

    beforeAll(async () => {
      const { tenantA: t } = await createIsolatedTenants();
      noSubTenant = t;

      // Delete all subscriptions to ensure none exist
      await prisma.subscription.deleteMany({
        where: { organization_id: noSubTenant.organization.id },
      });

      noSubSession = await createSession(noSubTenant.users.owner, noSubTenant.outlet.id);
      noSubApi = tenantApi(app, noSubSession);
    });

    it('allows GET requests without subscription', async () => {
      const response = await noSubApi.get('/api/v1/staff?limit=10');

      expect(response.status).toBe(200);
    });

    it('blocks POST requests without subscription', async () => {
      const response = await noSubApi.post('/api/v1/staff/invitations', {
        email: 'nosub-waiter@example.com',
        role: 'waiter',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('exempt routes', () => {
    it('health endpoint works without subscription', async () => {
      await prisma.subscription.deleteMany({
        where: { organization_id: tenant.organization.id },
      });

      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
    });

    it('auth routes work without subscription', async () => {
      await prisma.subscription.deleteMany({
        where: { organization_id: tenant.organization.id },
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      // Should fail auth, not subscription
      expect(response.status).toBe(401);
    });

    it('docs endpoint works without subscription', async () => {
      await prisma.subscription.deleteMany({
        where: { organization_id: tenant.organization.id },
      });

      const response = await request(app).get('/api/v1/docs.json');

      expect(response.status).toBe(200);
    });
  });
});
