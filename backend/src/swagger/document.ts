import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

import { env } from '@/config/env';
import { registry } from './registry';

export function generateOpenApiDocument(): object {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  // Use localhost in development, APP_URL in production
  const serverUrl = env.NODE_ENV === 'development' 
    ? `http://localhost:${env.PORT}`
    : env.APP_URL;

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Bansa API',
      version: '1.0.0',
      description: 'Multi-outlet restaurant SaaS API',
    },
    servers: [
      {
        url: serverUrl,
        description: env.NODE_ENV === 'development' ? 'Development' : 'Production',
      },
    ],
    security: [{ cookieAuth: [] }],
  });
}