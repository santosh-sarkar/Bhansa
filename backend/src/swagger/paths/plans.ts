import { z } from 'zod';

import { registry } from '@/swagger';
import { customPlanRequestSchema } from '@/validations/plans/custom-plan-request.schema';
import { subscriptionDetailSchema } from '@/validations/plans/subscription.schema';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const customPlanRequestResponseSchema = z.object({
  id: z.string().uuid(),
  contact_name: z.string(),
  contact_email: z.string().email(),
  outlet_count: z.number().int().nullable(),
  message: z.string().nullable(),
  handled: z.boolean(),
  created_at: z.string().datetime(),
});

const outletHeaders = z.object({ 'X-Outlet-Id': z.string().uuid() });

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