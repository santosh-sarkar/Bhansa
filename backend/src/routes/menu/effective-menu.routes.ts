import { Router } from 'express';

import { getEffectiveMenuController } from '@/controllers/menu/effective-menu.controller';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';

import './effective-menu.docs';

const effectiveMenuRouter = Router();

// All routes require authentication and outlet context
effectiveMenuRouter.use(authMiddleware);
effectiveMenuRouter.use(outletContextMiddleware);

effectiveMenuRouter.get('/', getEffectiveMenuController);

export { effectiveMenuRouter };