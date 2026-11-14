import { afterEach, describe, expect, it, jest } from '@jest/globals';

import request from 'supertest';
import { createApp } from '@/app';
import { generateOpenApiDocument } from '@/docs/openapi';

const app = createApp();

describe('GET /api/v1/docs.json', () => {
  it('returns the OpenAPI document', async () => {
    const response = await request(app).get('/api/v1/docs.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.info.title).toBe('Bansa API');
    expect(response.body.info.version).toBe('1.0.0');
    expect(response.body.servers).toBeDefined();
    expect(response.body.components?.securitySchemes).toBeDefined();
    expect(response.body.components?.securitySchemes?.cookieAuth).toBeDefined();
    expect(response.body.components?.securitySchemes?.guestAuth).toBeDefined();
    expect(response.body.paths).toBeDefined();
    expect(response.body.paths['/api/v1/health']).toBeDefined();
    expect(response.body.paths['/api/v1/health'].get).toBeDefined();
  });
});

describe('GET /api/v1/docs', () => {
  it('serves the Swagger UI HTML', async () => {
    const response = await request(app).get('/api/v1/docs/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('swagger-ui');
    expect(response.text).toContain('Bansa API Documentation');
  });
});

describe('generateOpenApiDocument', () => {
  it('produces a valid OpenAPI document structure', () => {
    const doc = generateOpenApiDocument() as {
      openapi: string;
      info: { title: string; version: string };
      servers: Array<{ url: string }>;
      components: { securitySchemes: Record<string, unknown> };
      paths: Record<string, unknown>;
    };

    expect(doc.openapi).toBe('3.0.3');
    expect(doc.info.title).toBe('Bansa API');
    expect(doc.info.version).toBe('1.0.0');
    expect(doc.servers).toHaveLength(1);
    expect(doc.components.securitySchemes.cookieAuth).toBeDefined();
    expect(doc.components.securitySchemes.guestAuth).toBeDefined();
  });
});
