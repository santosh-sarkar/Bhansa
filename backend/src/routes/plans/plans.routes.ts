import { Router } from 'express';

import { getSubscriptionController } from '@/controllers/plans/subscription.controller';
import { customPlanRequestController } from '@/controllers/plans/custom-plan-request.controller';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import { customPlanRequestSchema } from '@/validations/plans/custom-plan-request.schema';

import './plans.docs';

const plansRouter = Router();

plansRouter.use(authMiddleware, outletContextMiddleware);

plansRouter.get('/subscription', requirePermission('billing.manage'), getSubscriptionController);
plansRouter.post(
  '/subscription/custom-plan-request',
  validate({ body: customPlanRequestSchema.shape.body }),
  customPlanRequestController,
);

export { plansRouter };