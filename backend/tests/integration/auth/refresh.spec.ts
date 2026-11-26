import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/utils/password';
import { hashToken } from '@/utils/token';
import { createOrganization, createUser } from '../../helpers/factories';

const app = createApp();

const PASSWORD = 'password123';

const createVerifiedUser = async (email: string) => {
  const organization = await createOrganization();
  return createUser(organization.id, {
    email,
    password_hash: await hashPassword(PASSWORD),
    email_verified_at: new Date(),
  });
};

const login = async (email: string) => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });

  expect(response.status).toBe(200);

  return response;
};

const cookieValue = (setCookie: string | string[] | undefined, name: string) => {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!match) return undefined;

  return match.split(';')[0]!;
};

const refreshWith = (refreshCookie: string) =>
  request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);

// We know the refresh cookie exists after login
const getRefreshCookie = (setCookie: string | string[] | undefined) =>
  cookieValue(setCookie, 'refresh_token')!;

describe('POST /api/v1/auth/refresh', () => {
  it('rejects requests without a refresh token cookie', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an unknown refresh token', async () => {
    const response = await refreshWith('refresh_token=unknown-token');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an expired refresh token', async () => {
    const user = await createVerifiedUser('expired-refresh@example.com');
    const token = 'expired-refresh-token';

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: hashToken(token),
        expires_at: new Date(Date.now() - 60_000),
      },
    });

    const response = await refreshWith(`refresh_token=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rotates the refresh token and returns new access token in body', async () => {
    const user = await createVerifiedUser('rotate@example.com');
    const loginResponse = await login(user.email);
    const originalRefreshCookie = getRefreshCookie(loginResponse.headers['set-cookie']);

    const response = await refreshWith(originalRefreshCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({ id: user.id, email: user.email });
    expect(response.body.data.accessToken).toBeDefined();

    const setCookie = response.headers['set-cookie'] as unknown as string[];
    const nextRefreshCookie = getRefreshCookie(setCookie);

    expect(nextRefreshCookie).not.toBe(originalRefreshCookie);
    expect(cookieValue(setCookie, 'access_token')).toBeUndefined();

    const refreshCookieHeader = setCookie.find((cookie) => cookie.startsWith('refresh_token='))!;
    expect(refreshCookieHeader).toContain('Path=/api/v1/auth');
    expect(refreshCookieHeader).toContain('HttpOnly');

    const oldToken = await prisma.refreshToken.findFirst({
      where: { user_id: user.id, used_at: { not: null } },
    });
    expect(oldToken).not.toBeNull();
    expect(oldToken!.replaced_by).not.toBeNull();
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const user = await createVerifiedUser('replay@example.com');
    const loginResponse = await login(user.email);
    const originalRefreshCookie = getRefreshCookie(loginResponse.headers['set-cookie']);

    const rotated = await refreshWith(originalRefreshCookie);
    expect(rotated.status).toBe(200);
    const nextRefreshCookie = getRefreshCookie(rotated.headers['set-cookie']);

    // Replaying the consumed token is treated as theft.
    const replay = await refreshWith(originalRefreshCookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.message).toBe('Refresh token reuse detected');

    // The token issued by the rotation is revoked with the family.
    const afterReplay = await refreshWith(nextRefreshCookie);
    expect(afterReplay.status).toBe(401);

    const activeTokens = await prisma.refreshToken.count({
      where: { user_id: user.id, revoked_at: null },
    });
    expect(activeTokens).toBe(0);
  });

  it('rejects a valid token for a deactivated user', async () => {
    const user = await createVerifiedUser('deactivated-refresh@example.com');
    const loginResponse = await login(user.email);
    const refreshCookie = getRefreshCookie(loginResponse.headers['set-cookie']);

    await prisma.user.update({ where: { id: user.id }, data: { is_active: false } });

    const response = await refreshWith(refreshCookie);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
