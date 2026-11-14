import { Router } from 'express';
import { z } from 'zod';

import { getSubscriptionController } from '@/controllers/plans/subscription.controller';
import { customPlanRequestController } from '@/controllers/plans/custom-plan-request.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { outletContextMiddleware } from '@/middlewares/outletContext';
import { requirePermission } from '@/middlewares/permission';
import { validate } from '@/middlewares/validate';
import { subscriptionDetailSchema } from '@/validations/plans/subscription.schema';
import { customPlanRequestSchema } from '@/validations/plans/custom-plan-request.schema';

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

const customPlanRequestResponseSchema = z.object({
  id: z.string().uuid(),
  contact_name: z.string(),
  contact_email: z.string().email(),
  outlet_count: z.number().int().nullable(),
  message: z.string().nullable(),
  handled: z.boolean(),
  created_at: z.string().datetime(),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/subscription/custom-plan-request',
  tags: ['Subscription'],
  summary: 'Request a custom plan',
  description:
    'Submits a custom plan request (lead) with contact details, desired outlet count, and an optional message. The organization is derived from the authenticated user.',
  security: [{ cookieAuth: [] }],
  request: {
    headers: outletHeaders,
    body: {
      content: {
        'application/json': {
          schema: customPlanRequestSchema.shape.body,
        },
      },
    },
  },
  responses: {
    201: successResponse(
      'Custom plan request submitted',
      z.object({ lead: customPlanRequestResponseSchema }),
    ),
    400: errorResponse('Validation error'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Permission denied'),
  },
});

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
plansRouter.post(
  '/subscription/custom-plan-request',
  validate({ body: customPlanRequestSchema.shape.body }),
  customPlanRequestController,
);

export { plansRouter };
