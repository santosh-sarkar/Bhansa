import { Router } from 'express';

import { getHealth } from '@/controllers/health/health.controller';
import './health.docs';

const healthRouter = Router();

healthRouter.get('/health', getHealth);

export { healthRouter };