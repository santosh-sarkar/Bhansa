import { describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/services/email/email.service';
import { hashPassword } from '@/utils/password';
import { generateSecureToken, hashToken } from '@/utils/token';
import { createOrganization, createUser } from '../../helpers/factories';

const app = createApp();

const PASSWORD = 'password123';
const NEW_PASSWORD = 'newpassword456';

const sendPasswordResetEmailMock = jest
  .spyOn(emailService, 'sendPasswordResetEmail')
  .mockResolvedValue();

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

  expect(match).toBeDefined();

  return match!.split(';')[0]!;
};

const login = (email: string, password = PASSWORD) =>
  request(app).post('/api/v1/auth/login').send({ email, password });

const forgotPassword = (email: string) =>
  request(app).post('/api/v1/auth/forgot-password').send({ email });

const resetPassword = (token: string, password: string) =>
  request(app).post('/api/v1/auth/reset-password').send({ token, password });

const latestResetToken = async (userId: string) =>
  prisma.authToken.findFirstOrThrow({
    where: { user_id: userId, purpose: 'reset_password' },
    orderBy: { created_at: 'desc' },
  });

describe('POST /api/v1/auth/forgot-password', () => {
  it('queues a reset email for an existing account', async () => {
    sendPasswordResetEmailMock.mockClear();
    const user = await createVerifiedUser('forgot@example.com');

    const response = await forgotPassword(user.email);

    expect(response.status).toBe(200);
    expect(response.body.data.sent).toBe(true);

    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailMock.mock.calls[0]?.[0]).toBe(user.email);

    const token = await latestResetToken(user.id);
    const rawToken = sendPasswordResetEmailMock.mock.calls[0]?.[1];
    expect(rawToken).toBeDefined();
    expect(token.token_hash).toBe(hashToken(rawToken!));
    expect(token.token_hash).not.toBe(rawToken);
    expect(token.used_at).toBeNull();
    expect(token.expires_at.getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
  });

  it('always returns 200 for an unknown email and sends nothing', async () => {
    sendPasswordResetEmailMock.mockClear();

    const response = await forgotPassword('missing@example.com');

    expect(response.status).toBe(200);
    expect(response.body.data.sent).toBe(true);
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('stays quiet when a reset was requested within five minutes', async () => {
    sendPasswordResetEmailMock.mockClear();
    const user = await createVerifiedUser('forgot-throttle@example.com');

    await forgotPassword(user.email);
    const response = await forgotPassword(user.email);

    expect(response.status).toBe(200);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);

    const tokens = await prisma.authToken.count({
      where: { user_id: user.id, purpose: 'reset_password' },
    });
    expect(tokens).toBe(1);
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  it('changes the password and invalidates the old one', async () => {
    sendPasswordResetEmailMock.mockClear();
    const user = await createVerifiedUser('reset@example.com');

    await forgotPassword(user.email);
    const rawToken = sendPasswordResetEmailMock.mock.calls[0]?.[1]!;

    const response = await resetPassword(rawToken, NEW_PASSWORD);

    expect(response.status).toBe(200);
    expect(response.body.data.reset).toBe(true);

    expect((await login(user.email, PASSWORD)).status).toBe(401);
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
  });

  it('revokes every refresh-token family', async () => {
    sendPasswordResetEmailMock.mockClear();
    const user = await createVerifiedUser('reset-sessions@example.com');

    const firstLogin = await login(user.email);
    const secondLogin = await login(user.email);
    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);

    await forgotPassword(user.email);
    const rawToken = sendPasswordResetEmailMock.mock.calls[0]?.[1]!;

    const response = await resetPassword(rawToken, NEW_PASSWORD);
    expect(response.status).toBe(200);

    const active = await prisma.refreshToken.count({
      where: { user_id: user.id, revoked_at: null },
    });
    expect(active).toBe(0);

    const refreshCookie = cookieValue(
      firstLogin.headers['set-cookie'] as unknown as string[],
      'refresh_token',
    );
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(refresh.status).toBe(401);
  });

  it('accepts a reset token only once', async () => {
    sendPasswordResetEmailMock.mockClear();
    const user = await createVerifiedUser('reset-once@example.com');

    await forgotPassword(user.email);
    const rawToken = sendPasswordResetEmailMock.mock.calls[0]?.[1]!;

    expect((await resetPassword(rawToken, NEW_PASSWORD)).status).toBe(200);

    const second = await resetPassword(rawToken, 'anotherpassword789');
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an expired token', async () => {
    const user = await createVerifiedUser('reset-expired@example.com');
    const rawToken = generateSecureToken();

    await prisma.authToken.create({
      data: {
        user_id: user.id,
        purpose: 'reset_password',
        token_hash: hashToken(rawToken),
        expires_at: new Date(Date.now() - 60 * 1000),
      },
    });

    const response = await resetPassword(rawToken, NEW_PASSWORD);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    // The password was not touched.
    expect((await login(user.email, PASSWORD)).status).toBe(200);
  });

  it('rejects an unknown token', async () => {
    const response = await resetPassword('not-a-real-token', NEW_PASSWORD);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a password that is too short or too common', async () => {
    sendPasswordResetEmailMock.mockClear();
    const user = await createVerifiedUser('reset-weak@example.com');

    await forgotPassword(user.email);
    const rawToken = sendPasswordResetEmailMock.mock.calls[0]?.[1]!;

    const tooShort = await resetPassword(rawToken, 'short');
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.error.code).toBe('VALIDATION_ERROR');

    const tooCommon = await resetPassword(rawToken, 'password');
    expect(tooCommon.status).toBe(400);
    expect(tooCommon.body.error.code).toBe('VALIDATION_ERROR');

    // The token is still usable with a valid password.
    expect((await resetPassword(rawToken, NEW_PASSWORD)).status).toBe(200);
  });
});
