import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

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