import { afterEach, describe, expect, it, jest } from '@jest/globals';

import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';

const app = createApp();

describe('GET /api/v1/health', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 200 with the success envelope when the database is up', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { status: 'ok', checks: { api: 'ok', database: 'ok', redis: 'ok' } },
    });
  });

  it('returns 503 when the database check fails', async () => {
    jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('database down'));

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Database unavailable' },
    });
  });
});

describe('unknown routes', () => {
  it('returns 404 with the error envelope', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });
});
