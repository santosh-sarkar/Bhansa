import { describe, expect, it, jest } from '@jest/globals';

import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/services/email/email.service';

const app = createApp();

const sendVerificationEmailMock = jest
  .spyOn(emailService, 'sendVerificationEmail')
  .mockResolvedValue();

const register = (overrides: Record<string, string> = {}) =>
  request(app)
    .post('/api/v1/auth/register')
    .send({
      email: 'user@example.com',
      password: 'password123',
      full_name: 'Test User',
      organization_name: 'Test Org',
      organization_slug: 'test-org-default',
      ...overrides,
    });

describe('POST /api/v1/auth/verify-email', () => {
  it('verifies email with the token from the verification email', async () => {
    sendVerificationEmailMock.mockClear();

    const registerResponse = await register({
      email: 'verify@example.com',
      organization_name: 'Test Org',
      organization_slug: 'test-org-verify',
    });
    expect(registerResponse.status).toBe(201);

    const token = sendVerificationEmailMock.mock.calls[0]?.[1];
    expect(token).toBeDefined();

    const response = await request(app).post('/api/v1/auth/verify-email').send({ token });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'verify@example.com' } });
    expect(user.email_verified_at).not.toBeNull();

    const authToken = await prisma.authToken.findFirst({
      where: { user_id: user.id, purpose: 'verify_email' },
    });
    expect(authToken!.used_at).not.toBeNull();
  });

  it('rejects a verification token that was already used', async () => {
    sendVerificationEmailMock.mockClear();

    await register({
      email: 'verify-twice@example.com',
      organization_name: 'Test Org Twice',
      organization_slug: 'test-org-verify-twice',
    });

    const token = sendVerificationEmailMock.mock.calls[0]?.[1]!;

    const first = await request(app).post('/api/v1/auth/verify-email').send({ token });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/v1/auth/verify-email').send({ token });
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: 'invalid-token' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Invalid or expired verification token');
  });

  it('rejects missing token', async () => {
    const response = await request(app).post('/api/v1/auth/verify-email').send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/resend-verification', () => {
  it('rate limits resend after registration (token recently created)', async () => {
    // First register a user (which creates an initial verification token)
    await request(app).post('/api/v1/auth/register').send({
      email: 'resend@example.com',
      password: 'password123',
      full_name: 'Test User',
      organization_name: 'Test Org',
      organization_slug: 'test-org-resend',
    });

    // The resend should be rate limited since a token was just created during registration
    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'resend@example.com' });

    // Should be rate limited because registration just created a token
    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });

  it('returns success even for non-existent email (security)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'nonexistent@example.com' });

    // Should return success to not reveal if email exists
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.sent).toBe(true);
  });

  it('rejects already verified email', async () => {
    // Register and verify
    await request(app).post('/api/v1/auth/register').send({
      email: 'verified@example.com',
      password: 'password123',
      full_name: 'Test User',
      organization_name: 'Test Org',
      organization_slug: 'test-org-verified',
    });

    // Manually verify the user
    const user = await prisma.user.findUnique({
      where: { email: 'verified@example.com' },
    });
    await prisma.user.update({
      where: { id: user!.id },
      data: { email_verified_at: new Date() },
    });

    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'verified@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe('Email already verified');
  });

  it('rate limits resend requests', async () => {
    // First register a user (which creates an initial verification token)
    await request(app).post('/api/v1/auth/register').send({
      email: 'ratelimit@example.com',
      password: 'password123',
      full_name: 'Test User',
      organization_name: 'Test Org',
      organization_slug: 'test-org-ratelimit',
    });

    // First resend - should be rate limited since a token was just created during registration
    const firstResponse = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'ratelimit@example.com' });

    expect(firstResponse.status).toBe(429);

    // Wait a moment to ensure the rate limit window is different
    // Actually, the first resend should fail because registration just created a token
    // But the second resend should also be rate limited
    const secondResponse = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'ratelimit@example.com' });

    expect(secondResponse.status).toBe(429);
    expect(secondResponse.body.success).toBe(false);
    expect(secondResponse.body.error.code).toBe('RATE_LIMITED');
  });

  it('rejects invalid email format', async () => {
    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
