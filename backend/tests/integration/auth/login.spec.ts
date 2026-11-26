import { beforeAll, describe, expect, it } from '@jest/globals';

import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/utils/password';

const app = createApp();

describe('POST /api/v1/auth/login', () => {
  beforeAll(async () => {
    // Create a test user with verified email
    const passwordHash = await hashPassword('password123');
    await prisma.user.create({
      data: {
        email: 'login-test@example.com',
        password_hash: passwordHash,
        full_name: 'Login Test User',
        organization_id: (
          await prisma.organization.create({ data: { name: 'Test Org', slug: 'test-org-login' } })
        ).id,
        email_verified_at: new Date(),
      },
    });
  });

  it('logs in successfully with valid credentials', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'login-test@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      email: 'login-test@example.com',
      full_name: 'Login Test User',
    });
    expect(response.body.data.accessToken).toBeDefined();
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieArray.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('rejects invalid email', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'nonexistent@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Invalid email or password');
  });

  it('rejects wrong password', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'login-test@example.com',
      password: 'wrongpassword',
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Invalid email or password');
  });

  it('rejects unverified email', async () => {
    // Create user without verified email
    const passwordHash = await hashPassword('password123');
    await prisma.user.create({
      data: {
        email: 'unverified@example.com',
        password_hash: passwordHash,
        full_name: 'Unverified User',
        organization_id: (
          await prisma.organization.create({ data: { name: 'Test Org 2', slug: 'test-org-2' } })
        ).id,
      },
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'unverified@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Email not verified. Please verify your email first.');
  });

  it('rejects inactive user', async () => {
    const passwordHash = await hashPassword('password123');
    const org = await prisma.organization.create({
      data: { name: 'Test Org 3', slug: 'test-org-3' },
    });
    await prisma.user.create({
      data: {
        email: 'inactive@example.com',
        password_hash: passwordHash,
        full_name: 'Inactive User',
        organization_id: org.id,
        email_verified_at: new Date(),
        is_active: false,
      },
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'inactive@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Account is deactivated');
  });

  it('rejects invalid email format', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'not-an-email',
      password: 'password123',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'body.email' })]),
    );
  });

  it('rejects missing password', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'login-test@example.com',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'body.password' })]),
    );
  });
});
