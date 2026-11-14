import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/services/email/email.service';
import { hashToken } from '@/utils/token';
import { createInvitationRecord, createOutlet, createUser } from '../../helpers/factories';
import {
  createIsolatedTenants,
  createSession,
  createTrialSubscription,
  expectTenantDenied,
  tenantApi,
  type TenantApi,
  type TestTenant,
} from '../../helpers/tenant';

const app = createApp();

const uniqueEmail = (label: string) => `${label}-${randomUUID()}@example.com`;

const lastInvitationEmail = () => {
  const call = emailServiceSpy.mock.calls.at(-1);

  if (!call) {
    throw new Error('Expected an invitation email');
  }

  return { email: call[0], token: call[1], organizationName: call[2], roleName: call[3] };
};

let emailServiceSpy: jest.SpiedFunction<typeof emailService.sendInvitationEmail>;

describe('staff invitations', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let secondOutletId: string;
  let ownerApi: TenantApi;
  let managerApi: TenantApi;
  let waiterApi: TenantApi;
  let ownerSession: Awaited<ReturnType<typeof createSession>>;

  beforeAll(async () => {
    ({ tenantA, tenantB } = await createIsolatedTenants());
    secondOutletId = (await createOutlet(tenantA.organization.id, { name: 'Second Branch' })).id;

    // Create trial subscriptions for both tenants
    await createTrialSubscription(tenantA.organization.id);
    await createTrialSubscription(tenantB.organization.id);

    ownerSession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    ownerApi = tenantApi(app, ownerSession);
    managerApi = tenantApi(app, await createSession(tenantA.users.manager, tenantA.outlet.id));
    waiterApi = tenantApi(app, await createSession(tenantA.users.waiter, tenantA.outlet.id));

    emailServiceSpy = jest.spyOn(emailService, 'sendInvitationEmail');
    emailServiceSpy.mockResolvedValue(undefined);
  });

  beforeEach(() => {
    emailServiceSpy.mockClear();
  });

  afterAll(() => {
    emailServiceSpy.mockRestore();
  });

  describe('POST /staff/invitations', () => {
    it('creates a pending invitation, stores a hashed token and queues one email', async () => {
      const email = uniqueEmail('waiter');
      const response = await ownerApi.post('/api/v1/staff/invitations', {
        email,
        role: 'waiter',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invitation).toMatchObject({
        email,
        status: 'pending',
        role: { code: 'waiter' },
        outlet: { id: tenantA.outlet.id },
      });

      const invitation = await prisma.invitation.findUniqueOrThrow({
        where: { id: response.body.data.invitation.id },
      });
      const daysValid = (invitation.expires_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysValid).toBeGreaterThan(6.9);
      expect(daysValid).toBeLessThanOrEqual(7);

      expect(emailServiceSpy).toHaveBeenCalledTimes(1);
      const sent = lastInvitationEmail();
      expect(sent.email).toBe(email);
      expect(sent.organizationName).toBe(tenantA.organization.name);
      expect(sent.roleName).toBe('Waiter');
      expect(sent.token).toMatch(/^[a-f0-9]{64}$/);
      expect(invitation.token_hash).not.toBe(sent.token);
      expect(invitation.token_hash).toBe(hashToken(sent.token));
    });

    it('creates organization-wide Owner invitations without an outlet', async () => {
      const response = await ownerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('owner'),
        role: 'owner',
      });

      expect(response.status).toBe(201);
      expect(response.body.data.invitation.outlet).toBeNull();

      const invitation = await prisma.invitation.findUniqueOrThrow({
        where: { id: response.body.data.invitation.id },
      });
      expect(invitation.outlet_id).toBeNull();
    });

    it('rejects an Owner invitation that includes an outlet', async () => {
      const response = await ownerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('owner-outlet'),
        role: 'owner',
        outlet_id: tenantA.outlet.id,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('lets a Manager invite staff to their own outlet', async () => {
      const response = await managerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('manager-waiter'),
        role: 'waiter',
      });

      expect(response.status).toBe(201);
      expect(emailServiceSpy).toHaveBeenCalledTimes(1);
    });

    it('lets a Manager invite an equal-ranked Manager', async () => {
      const response = await managerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('manager-manager'),
        role: 'manager',
      });

      expect(response.status).toBe(201);
    });

    it('stops a Manager from granting a role above their own', async () => {
      const response = await managerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('manager-owner'),
        role: 'owner',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(emailServiceSpy).not.toHaveBeenCalled();
    });

    it('stops a Manager from inviting to an outlet they do not manage', async () => {
      const response = await managerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('manager-other-outlet'),
        role: 'waiter',
        outlet_id: secondOutletId,
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for an outlet outside the organization', async () => {
      const response = await ownerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('owner-foreign-outlet'),
        role: 'waiter',
        outlet_id: tenantB.outlet.id,
      });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for a soft-deleted outlet', async () => {
      const deleted = await createOutlet(tenantA.organization.id, { name: 'Deleted Branch' });
      await prisma.outlet.update({
        where: { id: deleted.id },
        data: { deleted_at: new Date() },
      });

      const response = await ownerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('owner-deleted-outlet'),
        role: 'waiter',
        outlet_id: deleted.id,
      });

      expect(response.status).toBe(404);
    });

    it('rejects an email that already belongs to an account, including another organization', async () => {
      const sameOrganization = await ownerApi.post('/api/v1/staff/invitations', {
        email: tenantA.users.waiter.email,
        role: 'waiter',
      });
      expect(sameOrganization.status).toBe(409);
      expect(sameOrganization.body.error.code).toBe('CONFLICT');

      const otherOrganization = await ownerApi.post('/api/v1/staff/invitations', {
        email: tenantB.users.waiter.email,
        role: 'waiter',
      });
      expect(otherOrganization.status).toBe(409);
      expect(otherOrganization.body.error.code).toBe('CONFLICT');
    });

    it('replaces the previous pending invitation for the same email', async () => {
      const email = uniqueEmail('repeat');
      const first = await ownerApi.post('/api/v1/staff/invitations', { email, role: 'waiter' });
      const second = await ownerApi.post('/api/v1/staff/invitations', { email, role: 'kitchen' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.data.invitation.id).not.toBe(second.body.data.invitation.id);

      const oldInvitation = await prisma.invitation.findUniqueOrThrow({
        where: { id: first.body.data.invitation.id },
      });
      expect(oldInvitation.status).toBe('revoked');

      const pending = await prisma.invitation.count({
        where: { organization_id: tenantA.organization.id, email, status: 'pending' },
      });
      expect(pending).toBe(1);
    });

    it('rejects invalid input', async () => {
      const invalidEmail = await ownerApi.post('/api/v1/staff/invitations', {
        email: 'not-an-email',
        role: 'waiter',
      });
      expect(invalidEmail.status).toBe(400);

      const unknownRole = await ownerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('cashier'),
        role: 'cashier',
      });
      expect(unknownRole.status).toBe(400);

      const invalidOutlet = await ownerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('bad-outlet'),
        role: 'waiter',
        outlet_id: 'not-a-uuid',
      });
      expect(invalidOutlet.status).toBe(400);
    });

    it('denies staff without staff.manage', async () => {
      const response = await waiterApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('waiter-attempt'),
        role: 'waiter',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('requires authentication and an outlet header', async () => {
      const unauthenticated = await request(app)
        .post('/api/v1/staff/invitations')
        .send({
          email: uniqueEmail('anonymous'),
          role: 'waiter',
        });
      expect(unauthenticated.status).toBe(401);

      const noOutlet = await request(app)
        .post('/api/v1/staff/invitations')
        .set('Cookie', ownerSession.cookie)
        .send({ email: uniqueEmail('no-outlet'), role: 'waiter' });
      expect(noOutlet.status).toBe(400);
      expect(noOutlet.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /staff/invitations', () => {
    it('lists every invitation in the organization for an Owner', async () => {
      const email = uniqueEmail('owner-list');
      const created = await ownerApi.post('/api/v1/staff/invitations', { email, role: 'waiter' });

      const response = await ownerApi.get('/api/v1/staff/invitations?limit=100');

      expect(response.status).toBe(200);
      expect(response.body.meta).toMatchObject({ page: 1, limit: 100 });
      expect(response.body.meta.total).toBeGreaterThanOrEqual(1);
      expect(response.body.data.invitations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: created.body.data.invitation.id, email }),
        ]),
      );
    });

    it('limits a Manager to invitations for their outlets', async () => {
      const ownEmail = uniqueEmail('manager-own-list');
      const own = await managerApi.post('/api/v1/staff/invitations', {
        email: ownEmail,
        role: 'waiter',
      });

      const otherEmail = uniqueEmail('owner-other-list');
      const other = await ownerApi.post('/api/v1/staff/invitations', {
        email: otherEmail,
        role: 'waiter',
        outlet_id: secondOutletId,
      });

      const ownerEmail = uniqueEmail('owner-wide-list');
      const organizationWide = await ownerApi.post('/api/v1/staff/invitations', {
        email: ownerEmail,
        role: 'owner',
      });

      const response = await managerApi.get('/api/v1/staff/invitations?limit=100');
      const ids = response.body.data.invitations.map((invitation: { id: string }) => invitation.id);

      expect(ids).toContain(own.body.data.invitation.id);
      expect(ids).not.toContain(other.body.data.invitation.id);
      expect(ids).not.toContain(organizationWide.body.data.invitation.id);
    });

    it('marks expired pending invitations before listing and filters by status', async () => {
      const email = uniqueEmail('expired');
      const expired = await createInvitationRecord({
        organizationId: tenantA.organization.id,
        roleCode: 'waiter',
        email,
        outletId: tenantA.outlet.id,
        invitedBy: tenantA.users.owner.id,
        expiresAt: new Date(Date.now() - 60_000),
      });

      const pending = await ownerApi.get('/api/v1/staff/invitations?status=pending&limit=100');
      const pendingIds = pending.body.data.invitations.map(
        (invitation: { id: string }) => invitation.id,
      );
      expect(pendingIds).not.toContain(expired.id);

      const expiredList = await ownerApi.get('/api/v1/staff/invitations?status=expired&limit=100');
      const expiredIds = expiredList.body.data.invitations.map(
        (invitation: { id: string }) => invitation.id,
      );
      expect(expiredIds).toContain(expired.id);

      const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: expired.id } });
      expect(stored.status).toBe('expired');
    });

    it('paginates and rejects out-of-range page sizes', async () => {
      const page = await ownerApi.get('/api/v1/staff/invitations?page=1&limit=1');
      expect(page.status).toBe(200);
      expect(page.body.data.invitations).toHaveLength(1);
      expect(page.body.meta).toMatchObject({ page: 1, limit: 1 });

      const tooLarge = await ownerApi.get('/api/v1/staff/invitations?limit=101');
      expect(tooLarge.status).toBe(400);

      const zeroPage = await ownerApi.get('/api/v1/staff/invitations?page=0');
      expect(zeroPage.status).toBe(400);

      const badStatus = await ownerApi.get('/api/v1/staff/invitations?status=unknown');
      expect(badStatus.status).toBe(400);
    });

    it('denies a Waiter and cross-tenant outlet access', async () => {
      const waiter = await waiterApi.get('/api/v1/staff/invitations');
      expect(waiter.status).toBe(403);

      const crossTenant = await tenantApi(app, ownerSession)
        .at(tenantB.outlet.id)
        .get('/api/v1/staff/invitations');
      expectTenantDenied(crossTenant);
    });
  });

  describe('DELETE /staff/invitations/:id', () => {
    it('revokes a pending invitation', async () => {
      const created = await ownerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('revoke'),
        role: 'waiter',
      });
      const id = created.body.data.invitation.id;

      const response = await ownerApi.delete(`/api/v1/staff/invitations/${id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.revoked).toBe(true);

      const stored = await prisma.invitation.findUniqueOrThrow({ where: { id } });
      expect(stored.status).toBe('revoked');
    });

    it('rejects revoking an invitation that is no longer pending', async () => {
      const created = await ownerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('revoke-twice'),
        role: 'waiter',
      });
      const id = created.body.data.invitation.id;

      expect((await ownerApi.delete(`/api/v1/staff/invitations/${id}`)).status).toBe(200);

      const second = await ownerApi.delete(`/api/v1/staff/invitations/${id}`);
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('CONFLICT');
    });

    it('returns 404 for unknown and other-organization invitations', async () => {
      const unknown = await ownerApi.delete(
        '/api/v1/staff/invitations/00000000-0000-4000-8000-000000000000',
      );
      expect(unknown.status).toBe(404);

      const foreign = await createInvitationRecord({
        organizationId: tenantB.organization.id,
        roleCode: 'waiter',
        email: uniqueEmail('foreign'),
        outletId: tenantB.outlet.id,
      });
      const denied = await ownerApi.delete(`/api/v1/staff/invitations/${foreign.id}`);
      expect(denied.status).toBe(404);
    });

    it('lets a Manager revoke invitations for their outlet only', async () => {
      const own = await managerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('manager-revoke'),
        role: 'waiter',
      });
      expect(
        (await managerApi.delete(`/api/v1/staff/invitations/${own.body.data.invitation.id}`))
          .status,
      ).toBe(200);

      const other = await ownerApi.post('/api/v1/staff/invitations', {
        email: uniqueEmail('manager-revoke-other'),
        role: 'waiter',
        outlet_id: secondOutletId,
      });
      const denied = await managerApi.delete(
        `/api/v1/staff/invitations/${other.body.data.invitation.id}`,
      );
      expect(denied.status).toBe(403);
    });

    it('validates the invitation id', async () => {
      const response = await ownerApi.delete('/api/v1/staff/invitations/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('OpenAPI', () => {
    it('documents the staff invitation endpoints', async () => {
      const response = await request(app).get('/api/v1/docs.json');

      expect(response.status).toBe(200);
      expect(response.body.paths['/api/v1/staff/invitations'].post).toBeDefined();
      expect(response.body.paths['/api/v1/staff/invitations'].get).toBeDefined();
      expect(response.body.paths['/api/v1/staff/invitations/{id}'].delete).toBeDefined();
    });
  });
});

describe('invitations email template', () => {
  it('skips sending in the test environment', async () => {
    const email = await createUser(null, { email: uniqueEmail('template') });

    await expect(
      emailService.sendInvitationEmail(
        email.email,
        'token',
        'Test',
        'Waiter',
        new Date(Date.now() + 1000),
      ),
    ).resolves.toBeUndefined();
  });
});
