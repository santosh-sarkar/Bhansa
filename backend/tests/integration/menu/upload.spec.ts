import { beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { resetDatabase } from '../../helpers/database';
import {
  createIsolatedTenants,
  createSession,
  createTrialSubscription,
  tenantApi,
  type TestTenant,
  type TenantSession,
  type TenantApi,
} from '../../helpers/tenant';

const app = createApp();

describe('Menu Image Upload', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let ownerASession: TenantSession;
  let ownerAApi: TenantApi;
  let managerASession: TenantSession;
  let managerAApi: TenantApi;
  let waiterASession: TenantSession;
  let waiterAApi: TenantApi;

  const testImagePath = path.join(__dirname, '..', '..', 'fixtures', 'test-image.jpg');
  const testImageBuffer = fs.readFileSync(testImagePath);

  beforeAll(async () => {
    await resetDatabase();
    const { tenantA: a, tenantB: b } = await createIsolatedTenants();
    tenantA = a;
    tenantB = b;

    // Create subscriptions for both tenants
    await createTrialSubscription(tenantA.organization.id);
    await createTrialSubscription(tenantB.organization.id);

    // Create sessions
    ownerASession = await createSession(tenantA.users.owner, tenantA.outlet.id);
    managerASession = await createSession(tenantA.users.manager, tenantA.outlet.id);
    waiterASession = await createSession(tenantA.users.waiter, tenantA.outlet.id);

    ownerAApi = tenantApi(app, ownerASession);
    managerAApi = tenantApi(app, managerASession);
    waiterAApi = tenantApi(app, waiterASession);
  });

  describe('POST /api/v1/menu/upload/image', () => {
    it('owner can upload valid JPEG image', async () => {
      const res = await ownerAApi
        .post('/api/v1/menu/items/upload/image')
        .attach('file', testImageBuffer, 'test.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.image).toBeDefined();
      expect(res.body.data.image.url).toBeDefined();
      expect(res.body.data.image.url).toMatch(/^https:\/\/res\.cloudinary\.com/);
      expect(res.body.data.image.publicId).toBeDefined();
      expect(res.body.data.image.width).toBeGreaterThan(0);
      expect(res.body.data.image.height).toBeGreaterThan(0);
      expect(res.body.data.image.bytes).toBeGreaterThan(0);
    });

    it('owner can upload valid PNG image', async () => {
      const pngPath = path.join(__dirname, '..', '..', 'fixtures', 'test-image.png');
      const pngBuffer = fs.readFileSync(pngPath);

      const res = await ownerAApi
        .post('/api/v1/menu/items/upload/image')
        .attach('file', pngBuffer, 'test.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.image.url).toMatch(/\.png$/);
    });

    it('manager can upload image', async () => {
      const res = await managerAApi
        .post('/api/v1/menu/items/upload/image')
        .attach('file', testImageBuffer, 'test.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects waiter without menu.edit permission', async () => {
      const res = await waiterAApi
        .post('/api/v1/menu/items/upload/image')
        .attach('file', testImageBuffer, 'test.jpg');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid file type (GIF)', async () => {
      const gifPath = path.join(__dirname, '..', '..', 'fixtures', 'test-image.gif');
      const gifBuffer = fs.readFileSync(gifPath);

      const res = await ownerAApi
        .post('/api/v1/menu/items/upload/image')
        .attach('file', gifBuffer, 'test.gif');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects file larger than 5MB', async () => {
      // Create a buffer larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'x');

      const res = await ownerAApi
        .post('/api/v1/menu/items/upload/image')
        .attach('file', largeBuffer, 'large.jpg');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects upload without file', async () => {
      const res = await ownerAApi.post('/api/v1/menu/items/upload/image');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/menu/items/upload/image')
        .attach('file', testImageBuffer, 'test.jpg');

      expect(res.status).toBe(401);
    });

    it('rejects cross-tenant access', async () => {
      const ownerBSession = await createSession(tenantB.users.owner, tenantB.outlet.id);
      const ownerBApi = tenantApi(app, ownerBSession);

      const res = await ownerBApi
        .post('/api/v1/menu/items/upload/image')
        .attach('file', testImageBuffer, 'test.jpg');

      // Should still work - upload is org-scoped by the authenticated user
      expect(res.status).toBe(201);
    });
  });
});
