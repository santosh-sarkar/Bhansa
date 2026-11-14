import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import { env } from '@/config/env';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'access_token',
  description: 'JWT access token in httpOnly cookie',
});

registry.registerComponent('securitySchemes', 'guestAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'guest_token',
  description: 'Guest session token in httpOnly cookie',
});

registry.registerComponent('parameters', 'X-Outlet-Id', {
  name: 'X-Outlet-Id',
  in: 'header',
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description: 'Outlet ID for outlet-scoped routes',
});

export function generateOpenApiDocument(): object {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Bansa API',
      version: '1.0.0',
      description: 'Multi-outlet restaurant SaaS API',
    },
    servers: [
      {
        url: env.APP_URL,
        description: 'Current environment',
      },
    ],
    security: [{ cookieAuth: [] }],
  });
}
