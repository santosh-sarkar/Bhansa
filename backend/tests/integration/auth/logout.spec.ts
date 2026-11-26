import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/utils/password';
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

const cookieValue = (setCookie: string | string[] | undefined, name: string) => {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!match) return undefined;

  return match.split(';')[0]!;
};

const getRefreshCookie = (setCookie: string | string[] | undefined) =>
  cookieValue(setCookie, 'refresh_token')!;

const login = async (email: string) => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });

  expect(response.status).toBe(200);
  expect(response.body.data.accessToken).toBeDefined();

  const setCookie = response.headers['set-cookie'] as unknown as string[];

  return {
    access: response.body.data.accessToken,
    refresh: getRefreshCookie(setCookie),
  };
};

const refreshWith = (refreshCookie: string) =>
  request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);

describe('POST /api/v1/auth/logout', () => {
  it('requires an access token', async () => {
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('revokes only the current session family', async () => {
    const user = await createVerifiedUser('logout-one@example.com');
    const first = await login(user.email);
    const second = await login(user.email);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${first.access}`)
      .set('Cookie', first.refresh);

    expect(response.status).toBe(200);
    expect(response.body.data.logged_out).toBe(true);

    const firstRefresh = await refreshWith(first.refresh);
    expect(firstRefresh.status).toBe(401);

    // The other device is still logged in.
    const secondRefresh = await refreshWith(second.refresh);
    expect(secondRefresh.status).toBe(200);
  });

  it('clears refresh token cookie', async () => {
    const user = await createVerifiedUser('logout-cookies@example.com');
    const session = await login(user.email);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${session.access}`)
      .set('Cookie', session.refresh);

    const setCookie = response.headers['set-cookie'] as unknown as string[];
    const clearedRefresh = setCookie.find((cookie) => cookie.startsWith('refresh_token=;'));

    expect(clearedRefresh).toBeDefined();
    expect(clearedRefresh).toContain('Path=/api/v1/auth');
    expect(clearedRefresh).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('is idempotent without a refresh cookie or with an unknown token', async () => {
    const user = await createVerifiedUser('logout-idempotent@example.com');
    const session = await login(user.email);

    const withoutRefresh = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${session.access}`);
    expect(withoutRefresh.status).toBe(200);

    const unknownToken = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${session.access}`)
      .set('Cookie', 'refresh_token=unknown-token');
    expect(unknownToken.status).toBe(200);

    // Nothing was revoked by the calls above.
    const active = await prisma.refreshToken.count({
      where: { user_id: user.id, revoked_at: null },
    });
    expect(active).toBe(1);
  });
});

describe('POST /api/v1/auth/logout-all', () => {
  it('requires an access token', async () => {
    const response = await request(app).post('/api/v1/auth/logout-all');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('revokes every session family for the user', async () => {
    const user = await createVerifiedUser('logout-all@example.com');
    const first = await login(user.email);
    const second = await login(user.email);

    const response = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${first.access}`)
      .set('Cookie', first.refresh);

    expect(response.status).toBe(200);
    expect(response.body.data.logged_out).toBe(true);

    expect((await refreshWith(first.refresh)).status).toBe(401);
    expect((await refreshWith(second.refresh)).status).toBe(401);

    const active = await prisma.refreshToken.count({
      where: { user_id: user.id, revoked_at: null },
    });
    expect(active).toBe(0);
  });
});
