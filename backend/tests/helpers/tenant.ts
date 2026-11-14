import { randomUUID } from 'node:crypto';

import type { Organization, Outlet, User } from '@prisma/client';
import type { Express } from 'express';
import request, { type Test } from 'supertest';

import { createAccessToken } from '@/services/auth/token.service';
import { ACCESS_COOKIE_NAME } from '@/utils/cookies';
import { createOrganization, createOutlet, createStaffAssignment, createUser } from './factories';
import { prisma } from '@/lib/prisma';

export const STAFF_ROLES = ['owner', 'manager', 'waiter', 'kitchen'] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export interface TestTenant {
  organization: Organization;
  outlet: Outlet;
  users: Record<StaffRole, User>;
}

export interface TenantSession {
  userId: string;
  outletId: string;
  cookie: string;
}

type ApiTest = Test;

export interface TenantApi {
  get(path: string): ApiTest;
  post(path: string, body?: object): ApiTest;
  patch(path: string, body?: object): ApiTest;
  put(path: string, body?: object): ApiTest;
  delete(path: string): ApiTest;
  /** Same signed-in user, different `X-Outlet-Id`. */
  at(outletId: string): TenantApi;
}

export interface TenantDenialResponse {
  status: number;
  body: { success?: boolean; error?: { code?: string } };
}

/**
 * Creates an organization, an outlet and one verified user per staff role.
 * The Owner gets the `outlet_id = NULL` assignment; everyone else is assigned
 * to the outlet.
 */
export async function createTestTenant(label = 'Tenant'): Promise<TestTenant> {
  const organization = await createOrganization({ name: `${label} Organization` });
  const outlet = await createOutlet(organization.id, { name: `${label} Outlet` });

  const users = {} as Record<StaffRole, User>;

  for (const role of STAFF_ROLES) {
    const user = await createUser(organization.id, {
      email: `${role}-${randomUUID()}@example.com`,
      full_name: `${label} ${role}`,
      email_verified_at: new Date(),
    });

    await createStaffAssignment({
      userId: user.id,
      roleCode: role,
      outletId: role === 'owner' ? null : outlet.id,
    });

    users[role] = user;
  }

  return { organization, outlet, users };
}

/**
 * Two tenants that must never see each other's data. Use this in every module
 * to assert cross-tenant reads, updates and deletes are rejected.
 */
export async function createIsolatedTenants(): Promise<{
  tenantA: TestTenant;
  tenantB: TestTenant;
}> {
  const [tenantA, tenantB] = await Promise.all([
    createTestTenant('Alpha'),
    createTestTenant('Beta'),
  ]);

  return { tenantA, tenantB };
}

/**
 * Creates a trial subscription for a tenant's organization.
 * Use this in tests that need an active subscription.
 */
export async function createTrialSubscription(organizationId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
  return prisma.subscription.create({
    data: {
      organization_id: organizationId,
      plan_id: plan.id,
      status: 'trialing',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });
}

/**
 * Creates a subscription with a specific status for a tenant's organization.
 */
export async function createSubscription(
  organizationId: string,
  status: 'trialing' | 'active' | 'grace' | 'suspended' | 'cancelled',
  overrides: Record<string, unknown> = {},
) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: 'single' } });
  const baseData = {
    organization: { connect: { id: organizationId } },
    plan: { connect: { id: plan.id } },
    status,
  } as const;

  if (status === 'trialing') {
    (baseData as Record<string, unknown>).trial_ends_at = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    );
  }
  if (status === 'grace') {
    (baseData as Record<string, unknown>).grace_ends_at = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );
  }

  return prisma.subscription.create({
    data: { ...baseData, ...overrides },
  });
}

/**
 * Signs a factory user in without hitting the login endpoint. The access cookie
 * is a real signed JWT, so `authMiddleware` and `outletContextMiddleware` run
 * for real.
 */
export async function createSession(user: User, outletId: string): Promise<TenantSession> {
  const accessToken = await createAccessToken(user);

  return {
    userId: user.id,
    outletId,
    cookie: `${ACCESS_COOKIE_NAME}=${accessToken}`,
  };
}

/**
 * Supertest client that sends the session cookie and `X-Outlet-Id` on every
 * request. `at()` switches the outlet header without changing the user.
 */
export function tenantApi(app: Express, session: TenantSession): TenantApi {
  const build = (outletId: string): TenantApi => {
    const send = (test: ApiTest, body?: object) => {
      const withHeaders = test.set('Cookie', session.cookie).set('X-Outlet-Id', outletId);

      return body === undefined ? withHeaders : withHeaders.send(body);
    };

    return {
      get: (path) => send(request(app).get(path)),
      post: (path, body) => send(request(app).post(path), body),
      patch: (path, body) => send(request(app).patch(path), body),
      put: (path, body) => send(request(app).put(path), body),
      delete: (path) => send(request(app).delete(path)),
      at: (otherOutletId) => build(otherOutletId),
    };
  };

  return build(session.outletId);
}

/**
 * Asserts a tenant-isolation rejection. Modules may return 403 or 404; both
 * are acceptable as long as the error envelope is used.
 */
export function expectTenantDenied(response: TenantDenialResponse): void {
  if (response.status !== 403 && response.status !== 404) {
    throw new Error(`Expected tenant isolation denial (403/404), received ${response.status}`);
  }

  if (response.body.success !== false) {
    throw new Error('Expected a failure envelope for a tenant isolation denial');
  }
}
