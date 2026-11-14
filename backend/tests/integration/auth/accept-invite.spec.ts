import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { generateSecureToken, hashToken } from '@/utils/token';
import {
  createInvitationRecord,
  createOrganization,
  createOutlet,
  createUser,
} from '../../helpers/factories';

const app = createApp();

const PASSWORD = 'password123';

const cookieValue = (setCookie: string | string[] | undefined, name: string) => {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  expect(match).toBeDefined();

  return match!.split(';')[0]!;
};

const acceptInvite = (body: Record<string, unknown>) =>
  request(app).post('/api/v1/auth/accept-invite').send(body);

const createPendingInvitation = async (options: {
  email: string;
  roleCode?: string;
  outletId?: string | null;
  status?: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt?: Date;
  organizationId?: string;
}) => {
  const rawToken = generateSecureToken();
  const organization = options.organizationId
    ? await prisma.organization.findUniqueOrThrow({ where: { id: options.organizationId } })
    : await createOrganization();
  const outlet = await createOutlet(organization.id);

  const invitation = await createInvitationRecord({
    organizationId: organization.id,
    roleCode: options.roleCode ?? 'waiter',
    email: options.email,
    outletId: options.outletId === undefined ? outlet.id : options.outletId,
    tokenHash: hashToken(rawToken),
    status: options.status ?? 'pending',
    ...(options.expiresAt !== undefined ? { expiresAt: options.expiresAt } : {}),
  });

  return { rawToken, invitation, organization, outlet };
};

describe('POST /api/v1/auth/accept-invite', () => {
  it('creates the account, assigns the outlet role and signs the user in', async () => {
    const { rawToken, invitation, organization, outlet } = await createPendingInvitation({
      email: 'invited-waiter@example.com',
    });

    const response = await acceptInvite({
      token: rawToken,
      full_name: 'Invited Waiter',
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      email: 'invited-waiter@example.com',
      full_name: 'Invited Waiter',
    });
    expect(response.body.data.organization).toMatchObject({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    });
    expect(response.body.data.assignment).toMatchObject({
      role: { code: 'waiter' },
      outlet: { id: outlet.id, name: outlet.name },
    });

    const setCookie = response.headers['set-cookie'] as unknown as string[];
    expect(cookieValue(setCookie, 'access_token')).toContain('access_token=');
    expect(cookieValue(setCookie, 'refresh_token')).toContain('refresh_token=');

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'invited-waiter@example.com' },
      include: {
        staffAssignments: { include: { role: true, outlet: true } },
      },
    });

    expect(user.organization_id).toBe(organization.id);
    expect(user.full_name).toBe('Invited Waiter');
    expect(user.email_verified_at).not.toBeNull();
    expect(user.is_active).toBe(true);
    expect(user.staffAssignments).toHaveLength(1);
    expect(user.staffAssignments[0]!.role.code).toBe('waiter');
    expect(user.staffAssignments[0]!.outlet?.id).toBe(outlet.id);

    const storedInvitation = await prisma.invitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(storedInvitation.status).toBe('accepted');

    const activeRefreshTokens = await prisma.refreshToken.count({
      where: { user_id: user.id, revoked_at: null },
    });
    expect(activeRefreshTokens).toBe(1);

    // The cookies really authenticate the new user.
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `${cookieValue(setCookie, 'access_token')}`);

    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(user.id);
    expect(me.body.data.assignments[0]).toMatchObject({
      outlet: { id: outlet.id },
      role: { code: 'waiter' },
    });
  });

  it('lets the new staff member log in with the chosen password', async () => {
    const { rawToken } = await createPendingInvitation({
      email: 'invited-login@example.com',
    });

    const accepted = await acceptInvite({
      token: rawToken,
      full_name: 'Invited Login',
      password: PASSWORD,
    });
    expect(accepted.status).toBe(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'invited-login@example.com', password: PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.data.user.email).toBe('invited-login@example.com');

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'invited-login@example.com', password: 'wrong-password' });

    expect(wrongPassword.status).toBe(401);
  });

  it('creates an organization-wide assignment for an owner invitation', async () => {
    const { rawToken, organization } = await createPendingInvitation({
      email: 'invited-owner@example.com',
      roleCode: 'owner',
      outletId: null,
    });

    const response = await acceptInvite({
      token: rawToken,
      full_name: 'Second Owner',
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.assignment).toMatchObject({
      role: { code: 'owner' },
      outlet: null,
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'invited-owner@example.com' },
      include: { staffAssignments: { include: { role: true } } },
    });

    expect(user.organization_id).toBe(organization.id);
    expect(user.staffAssignments).toHaveLength(1);
    expect(user.staffAssignments[0]!.outlet_id).toBeNull();
    expect(user.staffAssignments[0]!.role.code).toBe('owner');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set(
        'Cookie',
        cookieValue(response.headers['set-cookie'] as unknown as string[], 'access_token'),
      );

    expect(me.status).toBe(200);
    expect(me.body.data.permissions).toEqual(expect.arrayContaining(['staff.manage']));
  });

  it('rejects an unknown token', async () => {
    const response = await acceptInvite({
      token: 'not-a-real-invitation-token',
      full_name: 'Nobody',
      password: PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.success).toBe(false);
  });

  it('rejects a revoked invitation', async () => {
    const { rawToken } = await createPendingInvitation({
      email: 'invited-revoked@example.com',
      status: 'revoked',
    });

    const response = await acceptInvite({
      token: rawToken,
      full_name: 'Revoked Invite',
      password: PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an expired invitation and marks it expired', async () => {
    const { rawToken, invitation } = await createPendingInvitation({
      email: 'invited-expired@example.com',
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    const response = await acceptInvite({
      token: rawToken,
      full_name: 'Expired Invite',
      password: PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(stored.status).toBe('expired');
  });

  it('rejects an invitation that was already accepted', async () => {
    const { rawToken } = await createPendingInvitation({
      email: 'invited-accepted@example.com',
      status: 'accepted',
    });

    const response = await acceptInvite({
      token: rawToken,
      full_name: 'Already Accepted',
      password: PASSWORD,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('allows only one acceptance per token', async () => {
    const { rawToken } = await createPendingInvitation({
      email: 'invited-once@example.com',
    });

    const first = await acceptInvite({
      token: rawToken,
      full_name: 'First Acceptance',
      password: PASSWORD,
    });
    expect(first.status).toBe(201);

    const second = await acceptInvite({
      token: rawToken,
      full_name: 'Second Acceptance',
      password: 'anotherpassword456',
    });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');

    const users = await prisma.user.count({ where: { email: 'invited-once@example.com' } });
    expect(users).toBe(1);
  });

  it('rejects an invitation when an account with the email already exists', async () => {
    const organization = await createOrganization();
    await createUser(organization.id, { email: 'existing-account@example.com' });

    const { rawToken } = await createPendingInvitation({
      email: 'existing-account@example.com',
    });

    const response = await acceptInvite({
      token: rawToken,
      full_name: 'Existing Account',
      password: PASSWORD,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');

    const users = await prisma.user.count({ where: { email: 'existing-account@example.com' } });
    expect(users).toBe(1);
  });

  it('validates the payload', async () => {
    const { rawToken } = await createPendingInvitation({
      email: 'invited-validation@example.com',
    });

    const missingToken = await acceptInvite({ full_name: 'No Token', password: PASSWORD });
    expect(missingToken.status).toBe(400);
    expect(missingToken.body.error.code).toBe('VALIDATION_ERROR');

    const missingName = await acceptInvite({ token: rawToken, password: PASSWORD });
    expect(missingName.status).toBe(400);
    expect(missingName.body.error.code).toBe('VALIDATION_ERROR');

    const shortPassword = await acceptInvite({
      token: rawToken,
      full_name: 'Short Password',
      password: 'short',
    });
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.error.code).toBe('VALIDATION_ERROR');

    // The invitation survives rejected payloads.
    const stored = await prisma.invitation.findFirstOrThrow({
      where: { email: 'invited-validation@example.com' },
    });
    expect(stored.status).toBe('pending');
  });
});
