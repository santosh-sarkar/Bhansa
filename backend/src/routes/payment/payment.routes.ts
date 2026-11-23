import { Router } from 'express';
import { z } from 'zod';

import { recordCashPaymentController, getPaymentController, listPaymentsController } from '@/controllers/payment/payment.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const paymentRouter = Router();

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

const successResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: { 'application/json': { schema: z.object({ success: z.literal(true), data }) } },
});

const paginatedResponse = <T extends z.ZodType>(description: string, data: T) => ({
  description,
  content: {
    'application/json': {
      schema: z.object({
        success: z.literal(true),
        data: z.array(data),
        pagination: z.object({
          page: z.number().int().positive(),
          limit: z.number().int().positive(),
          total: z.number().int().nonnegative(),
          totalPages: z.number().int().nonnegative(),
        }),
      }),
    },
  },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

const paymentDetailSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid(),
  bill_id: z.string().uuid(),
  invoice_number: z.string().nullable(),
  method: z.string(),
  status: z.string(),
  amount: z.string(),
  provider_ref: z.string().nullable(),
  idempotency_key: z.string().nullable(),
  transaction_uuid: z.string().nullable(),
  recorded_at: z.string().datetime(),
  verified_at: z.string().datetime().nullable(),
  recorded_by: z.string().uuid().nullable(),
});

const recordCashPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    idempotency_key: z.string().max(64).optional(),
  }),
});

const paymentIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const listPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['pending', 'succeeded', 'failed', 'refunded']).optional(),
    method: z.enum(['cash', 'card', 'online']).optional(),
    outlet_id: z.string().uuid().optional(),
    bill_id: z.string().uuid().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/bills/{id}/payment/cash',
  tags: ['Payments'],
  summary: 'Record cash payment for a bill',
  description:
    'Records a cash payment for a bill. Updates bill status to paid, closes session, frees table, and completes orders. Requires payment.record permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/), idempotency_key: z.string().max(64).optional() }) } },
    },
  },
  responses: {
    200: successResponse('Cash payment recorded', paymentDetailSchema),
    400: errorResponse('Validation error or bill already paid or session has uncompleted orders'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Bill not found'),
    409: errorResponse('Idempotency key conflict'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/payments/{id}',
  tags: ['Payments'],
  summary: 'Get payment by ID',
  description: 'Returns detailed payment information. Requires payment.record permission.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Payment details', paymentDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Payment not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/payments',
  tags: ['Payments'],
  summary: 'List payments',
  description: 'Returns paginated list of payments with filters. Requires payment.record permission.',
  security: [{ cookieAuth: [] }],
  request: { query: listPaymentsSchema.shape.query },
  responses: {
    200: paginatedResponse('Payments list', paymentDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});

// All routes require authentication
paymentRouter.use(authMiddleware);

// Record cash payment for a bill - requires payment.record permission
paymentRouter.post(
  '/bills/{id}/payment/cash',
  requireOrgPermission('payment.record'),
  validate({ params: recordCashPaymentSchema.shape.params, body: recordCashPaymentSchema.shape.body }),
  recordCashPaymentController,
);

// Get payment by ID - requires payment.record permission
paymentRouter.get(
  '/payments/{id}',
  requireOrgPermission('payment.record'),
  validate({ params: paymentIdSchema.shape.params }),
  getPaymentController,
);

// List payments - requires payment.record permission
paymentRouter.get(
  '/payments',
  requireOrgPermission('payment.record'),
  validate({ query: listPaymentsSchema.shape.query }),
  listPaymentsController,
);

export { paymentRouter };