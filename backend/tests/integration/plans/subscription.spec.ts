import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import {
  createOrganization,
  createOutlet,
  createStaffAssignment,
  createUser,
} from '../../helpers/factories';
import {
  createIsolatedTenants,
  createSession,
  createTrialSubscription,
  tenantApi,
  type TenantApi,
  type TenantSession,
  type TestTenant,
} from '../../helpers/tenant';

const app = createApp();

describe('GET /api/v1/plans/subscription', () => {
  let tenant: TestTenant;
  let ownerSession: TenantSession;
  let ownerApi: TenantApi;

  beforeAll(async () => {
    const { tenantA: t } = await createIsolatedTenants();
    tenant = t;
    await createTrialSubscription(tenant.organization.id);

    ownerSession = await createSession(tenant.users.owner, tenant.outlet.id);
    ownerApi = tenantApi(app, ownerSession);
  });

  it('returns subscription details with usage versus limits', async () => {
    const response = await ownerApi.get('/api/v1/plans/subscription');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const { subscription } = response.body.data;

    expect(subscription).toMatchObject({
      status: 'trialing',
      plan: {
        code: 'single',
        name: 'Single Outlet',
        currency: 'NPR',
        max_outlets: 1,
        multi_outlet_enabled: false,
      },
      max_outlets_override: null,
      max_staff_override: null,
      max_menu_items_override: null,
    });

    expect(subscription.trial_ends_at).not.toBeNull();
    expect(subscription.usage).toMatchObject({
      outlets: { limit: 1 },
      staff: { limit: null },
      menu_items: { limit: null },
    });
  });

  it('includes outlet usage count', async () => {
    const response = await ownerApi.get('/api/v1/plans/subscription');

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.usage.outlets.current).toBe(1);
  });

  it('includes staff usage count', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'waiter' } });
    await createUser(tenant.organization.id, {
      email: 'staff-usage@example.com',
      full_name: 'Staff Usage',
      email_verified_at: new Date(),
      is_active: true,
    }).then((user) => createStaffAssignment({ userId: user.id, roleCode: 'waiter' }));

    const response = await ownerApi.get('/api/v1/plans/subscription');

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.usage.staff.current).toBeGreaterThan(0);
  });

  it('includes menu item usage count', async () => {
    const category = await prisma.menuCategory.create({
      data: { organization_id: tenant.organization.id, name: 'Test Category' },
    });
    await prisma.menuItem.create({
      data: {
        organization_id: tenant.organization.id,
        category_id: category.id,
        name: 'Test Item',
        base_price: '100.00',
        is_active: true,
      },
    });

    const response = await ownerApi.get('/api/v1/plans/subscription');

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.usage.menu_items.current).toBeGreaterThan(0);
  });

  it('respects subscription overrides', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Override Org', slug: `override-${Date.now()}`, currency: 'NPR' },
    });
    await createOutlet(org.id);
    await createTrialSubscription(org.id);

    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
    await prisma.subscription.updateMany({
      where: { organization_id: org.id },
      data: { max_outlets_override: 5, max_staff_override: 10, max_menu_items_override: 100 },
    });

    const owner = await createUser(org.id, {
      email: 'owner@example.com',
      full_name: 'Owner',
      email_verified_at: new Date(),
    });
    await createStaffAssignment({ userId: owner.id, roleCode: 'owner' });
    const session = await createSession(owner, (await createOutlet(org.id)).id);
    const api = tenantApi(app, session);

    const response = await api.get('/api/v1/plans/subscription');

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.max_outlets_override).toBe(5);
    expect(response.body.data.subscription.max_staff_override).toBe(10);
    expect(response.body.data.subscription.max_menu_items_override).toBe(100);
    expect(response.body.data.subscription.usage.outlets.limit).toBe(5);
    expect(response.body.data.subscription.usage.staff.limit).toBe(10);
    expect(response.body.data.subscription.usage.menu_items.limit).toBe(100);
  });

  it('requires billing.manage permission', async () => {
    const managerSession = await createSession(tenant.users.manager, tenant.outlet.id);
    const managerApi = tenantApi(app, managerSession);

    const response = await managerApi.get('/api/v1/plans/subscription');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('requires authentication', async () => {
    const response = await request(app)
      .get('/api/v1/plans/subscription')
      .set('X-Outlet-Id', tenant.outlet.id);

    expect(response.status).toBe(401);
  });

  it('requires outlet header', async () => {
    const response = await request(app)
      .get('/api/v1/plans/subscription')
      .set('Cookie', ownerSession.cookie);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when no active subscription', async () => {
    const org = await prisma.organization.create({
      data: { name: 'No Sub Org', slug: `no-sub-${Date.now()}`, currency: 'NPR' },
    });
    await createOutlet(org.id);
    // No subscription created

    const user = await createUser(org.id, {
      email: 'nosub@example.com',
      full_name: 'No Sub',
      email_verified_at: new Date(),
    });
    await prisma.staffAssignment.create({
      data: {
        user_id: user.id,
        role_id: (await prisma.role.findUniqueOrThrow({ where: { code: 'owner' } })).id,
        outlet_id: null,
      },
    });

    const session = await createSession(user, (await createOutlet(org.id)).id);
    const api = tenantApi(app, session);

    const response = await api.get('/api/v1/plans/subscription');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
