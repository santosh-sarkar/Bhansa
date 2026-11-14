import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { generateOpenApiDocument } from '@/docs/openapi';

export const docsRouter = Router();

docsRouter.get('/docs.json', (_req, res) => {
  res.json(generateOpenApiDocument());
});

docsRouter.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    customSiteTitle: 'Bansa API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      url: '/api/v1/docs.json',
    },
  }),
);
