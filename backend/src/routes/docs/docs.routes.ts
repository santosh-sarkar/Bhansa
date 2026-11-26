import { Router } from 'express';

import { swaggerUiRouter } from '@/swagger';

export const docsRouter = Router();

docsRouter.use(swaggerUiRouter);