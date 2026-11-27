import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

const listSubscriptionPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['submitted', 'approved', 'rejected']).optional(),
    organization_id: z.string().uuid().optional(),
  }),
});

const subscriptionPaymentDetailSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  amount: z.string(),
  reference: z.string(),
  status: z.string(),
  period_months: z.number().int().positive(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  subscription: z.object({
    id: z.string().uuid(),
    status: z.string(),
    plan: z.object({
      name: z.string(),
      price_monthly: z.string(),
    }),
  }),
});

const subscriptionPaymentListItemSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  organization_name: z.string().nullable(),
  subscription_id: z.string().uuid(),
  amount: z.string(),
  reference: z.string(),
  status: z.string(),
  period_months: z.number().int().positive(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/subscription/payments',
  tags: ['Subscription', 'Payments'],
  summary: 'Submit subscription payment reference',
  description:
    'Owner submits a payment reference (e.g., bank transfer reference) for subscription renewal. ' +
    'Creates a pending payment that requires Super Admin approval. Requires billing.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            subscription_id: z.string().uuid(),
            amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
            reference: z.string().min(1).max(128),
            period_months: z.number().int().positive().default(1),
          }),
        },
      },
    },
  },
  responses: {
    201: successResponse('Subscription payment submitted', subscriptionPaymentDetailSchema),
    400: errorResponse('Validation error or subscription not renewable'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires billing.manage permission'),
    404: errorResponse('Subscription not found'),
    409: errorResponse('Pending payment already exists'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/subscription/payments/{id}/review',
  tags: ['Subscription', 'Payments'],
  summary: 'Review subscription payment (Super Admin)',
  description:
    'Super Admin approves or rejects a submitted subscription payment. ' +
    'On approval, extends the subscription period. Requires Super Admin role.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': { schema: z.object({ action: z.enum(['approve', 'reject']) }) },
      },
    },
  },
  responses: {
    200: successResponse('Subscription payment reviewed', subscriptionPaymentDetailSchema),
    400: errorResponse('Validation error or already reviewed'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden - Super Admin required'),
    404: errorResponse('Payment not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/subscription/payments/{id}',
  tags: ['Subscription', 'Payments'],
  summary: 'Get subscription payment by ID',
  description: 'Returns subscription payment details. Owner sees their own; Super Admin sees all. Requires billing.manage permission.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Subscription payment details', subscriptionPaymentDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Payment not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/subscription/payments',
  tags: ['Subscription', 'Payments'],
  summary: 'List subscription payments',
  description: 'Returns paginated list of subscription payments. Owner sees their organization; Super Admin sees all. Requires billing.manage permission.',
  security: [{ cookieAuth: [] }],
  request: { query: listSubscriptionPaymentsSchema.shape.query },
  responses: {
    200: {
      description: 'Subscription payments list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(subscriptionPaymentListItemSchema),
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires billing.manage permission'),
  },
});