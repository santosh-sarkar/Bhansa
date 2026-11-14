import { describe, expect, it } from '@jest/globals';

import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';

const app = createApp();

describe('POST /api/v1/auth/register', () => {
  it('creates organization, outlet, owner, and trial subscription', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'owner@example.com',
      password: 'password123',
      full_name: 'Test Owner',
      organization_name: 'Test Restaurant',
      organization_slug: 'test-restaurant',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.organization).toMatchObject({
      name: 'Test Restaurant',
      slug: 'test-restaurant',
    });
    expect(response.body.data.outlet).toMatchObject({
      name: 'Main Branch',
    });
    expect(response.body.data.user).toMatchObject({
      email: 'owner@example.com',
      full_name: 'Test Owner',
    });
    expect(response.body.data.subscription).toHaveProperty('trial_ends_at');

    // Verify in database
    const org = await prisma.organization.findUnique({
      where: { slug: 'test-restaurant' },
      include: {
        outlets: true,
        users: true,
        subscriptions: { include: { plan: true } },
      },
    });

    expect(org).not.toBeNull();
    if (!org) return;

    expect(org.outlets).toHaveLength(1);
    expect(org.outlets[0]!.name).toBe('Main Branch');
    expect(org.users).toHaveLength(1);
    expect(org.users[0]!.email).toBe('owner@example.com');
    expect(org.users[0]!.full_name).toBe('Test Owner');
    expect(org.users[0]!.email_verified_at).toBeNull();
    expect(org.subscriptions).toHaveLength(1);
    expect(org.subscriptions[0]!.status).toBe('trialing');
    expect(org.subscriptions[0]!.plan.code).toBe('trial');

    const assignment = await prisma.staffAssignment.findFirst({
      where: { user_id: org.users[0]!.id, outlet_id: null },
      include: { role: true },
    });
    expect(assignment).not.toBeNull();
    if (assignment) {
      expect(assignment.role.code).toBe('owner');
    }
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'dup@example.com',
      password: 'password123',
      full_name: 'First',
      organization_name: 'Org 1',
      organization_slug: 'org-1',
    });

    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'dup@example.com',
      password: 'password456',
      full_name: 'Second',
      organization_name: 'Org 2',
      organization_slug: 'org-2',
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe('Email already registered');
  });

  it('rejects duplicate organization slug', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'first@example.com',
      password: 'password123',
      full_name: 'First',
      organization_name: 'Org 1',
      organization_slug: 'org-1',
    });

    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'second@example.com',
      password: 'password123',
      full_name: 'Second',
      organization_name: 'Org 2',
      organization_slug: 'org-1',
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe('Organization slug already taken');
  });

  it('rejects invalid email', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'password123',
      full_name: 'Test',
      organization_name: 'Test',
      organization_slug: 'test-org',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'body.email' })]),
    );
  });

  it('rejects short password', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'short',
      full_name: 'Test',
      organization_name: 'Test',
      organization_slug: 'test-org',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'body.password' })]),
    );
  });

  it('rejects invalid slug format', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'password123',
      full_name: 'Test',
      organization_name: 'Test',
      organization_slug: 'Invalid Slug!',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'body.organization_slug' })]),
    );
  });
});
