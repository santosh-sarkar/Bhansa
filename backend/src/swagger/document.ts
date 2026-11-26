import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

import { env } from '@/config/env';
import { registry } from './registry';

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