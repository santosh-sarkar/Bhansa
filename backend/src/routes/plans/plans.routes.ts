import { Router } from 'express';
import { z } from 'zod';

import { getSubscriptionController } from '@/controllers/plans/subscription.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import { requirePermission } from '@/middlewares/permission';
import { subscriptionDetailSchema } from '@/validations/plans/subscription.schema';

const plansRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const successResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

const outletHeaders = z.object({ 'X-Outlet-Id': z.string().uuid() });

registry.registerPath({
  method: 'get',
  path: '/api/v1/subscription',
  tags: ['Subscription'],
  summary: 'Get current subscription with usage versus limits',
  description:
    'Returns the active subscription details including plan, status, trial/grace dates, override limits, and current usage versus effective limits for outlets, staff, and menu items.',
  security: [{ cookieAuth: [] }],
  request: { headers: outletHeaders },
  responses: {
    200: successResponse(
      'Subscription details',
      z.object({ subscription: subscriptionDetailSchema }),
    ),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Permission denied or subscription suspended'),
    404: errorResponse('No active subscription found'),
  },
});

plansRouter.use(authMiddleware, outletContextMiddleware);

plansRouter.get('/subscription', requirePermission('billing.manage'), getSubscriptionController);

export { plansRouter };
