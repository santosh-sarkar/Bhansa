import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { SignJWT } from 'jose';

import { createApp } from '@/app';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/utils/password';
import { createOrganization, createOutlet, createUser } from '../../helpers/factories';

const app = createApp();

const signAccessToken = async (userId: string, expiresIn = '15m') => {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  return new SignJWT({ org: null, sa: false })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setSubject(userId)
    .sign(secret);
};

const loginAs = async (email: string, password = 'password123') => {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });

  expect(response.status).toBe(200);

  const cookies = response.headers['set-cookie'];
  const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
  const accessCookie = cookieArray.find((cookie: string) => cookie.startsWith('access_token='));

  expect(accessCookie).toBeDefined();

  return accessCookie!.split(';')[0]!;
};

describe('GET /api/v1/auth/me', () => {
  let email: string;
  let userId: string;

  beforeAll(async () => {
    const organization = await createOrganization({ name: 'Me Test Org' });
    const outlet = await createOutlet(organization.id, { name: 'Me Test Outlet' });
    const user = await createUser(organization.id, {
      email: 'me-test@example.com',
      full_name: 'Me Test User',
      password_hash: await hashPassword('password123'),
      email_verified_at: new Date(),
      last_outlet_id: outlet.id,
    });

    const ownerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'owner' } });
    await prisma.staffAssignment.create({
      data: { user_id: user.id, role_id: ownerRole.id },
    });

    email = user.email;
    userId = user.id;
  });

  it('rejects requests without an access token cookie', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects requests with an invalid access token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'access_token=not-a-valid-jwt');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects requests with an expired access token', async () => {
    const expiredToken = await signAccessToken(userId, '-1m');

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `access_token=${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body.error.message).toBe('Access token expired');
  });

  it('rejects a valid token for a deactivated user', async () => {
    const token = await signAccessToken(userId);

    await prisma.user.update({
      where: { id: userId },
      data: { is_active: false },
    });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `access_token=${token}`);

    await prisma.user.update({
      where: { id: userId },
      data: { is_active: true },
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns the current user with organization, assignments, permissions and outlet', async () => {
    const cookie = await loginAs(email);

    const response = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const { data } = response.body;

    expect(data.user).toMatchObject({
      id: userId,
      email,
      full_name: 'Me Test User',
    });
    expect(data.organization).toMatchObject({ name: 'Me Test Org' });
    expect(data.assignments).toHaveLength(1);
    expect(data.assignments[0]).toMatchObject({
      outlet: null,
      role: { code: 'owner' },
    });
    expect(data.permissions).toEqual(expect.arrayContaining(['order.create', 'order.cancel']));
    expect(data.last_outlet).toMatchObject({ name: 'Me Test Outlet' });
  });
});
