import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
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
  security: [{ bearerAuth: [] }],
  request: { query: listPaymentsSchema.shape.query },
  responses: {
    200: {
      description: 'Payments list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(paymentDetailSchema),
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
});
