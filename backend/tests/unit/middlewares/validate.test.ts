import express from 'express';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

import { errorHandler } from '@/middlewares/errorHandler';
import { notFoundHandler } from '@/middlewares/notFoundHandler';
import { validate } from '@/middlewares/validate';
import type { Request, Response } from 'express';

const itemId = '6f1d7e3a-3f0e-4a4e-9a1e-2b8f7c6d5e4f';

function createTestApp(): express.Express {
  const server = express();
  server.use(express.json());
  server.post(
    '/items/:id',
    validate({
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ page: z.coerce.number().int().min(1) }),
      body: z.object({ name: z.string().min(2) }),
    }),
    (req: Request, res: Response) => {
      res.json({ params: req.params, query: req.query, body: req.body as unknown });
    },
  );
  server.use(notFoundHandler);
  server.use(errorHandler);

  return server;
}

const app = createTestApp();

describe('validate middleware', () => {
  it('replaces the request data with the parsed values', async () => {
    const response = await request(app)
      .post(`/items/${itemId}?page=2`)
      .send({ name: 'Tea', extra: 'stripped' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      params: { id: itemId },
      query: { page: 2 },
      body: { name: 'Tea' },
    });
  });

  it('returns VALIDATION_ERROR with every issue when a section is invalid', async () => {
    const response = await request(app).post('/items/not-a-uuid?page=0').send({ name: 'x' });
    const body = response.body as {
      success: boolean;
      error: { code: string; details: unknown };
    };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual([
      { path: 'params.id', message: 'Invalid UUID' },
      { path: 'query.page', message: 'Too small: expected number to be >=1' },
      { path: 'body.name', message: 'Too small: expected string to have >=2 characters' },
    ]);
  });
});
