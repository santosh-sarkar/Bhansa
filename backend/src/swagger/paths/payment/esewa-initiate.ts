import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse } from '@/swagger/schemas/common';

const formFieldsSchema = z.record(z.string(), z.string()).openapi({
  type: 'object',
  additionalProperties: { type: 'string' },
  description: 'eSewa form fields as key-value pairs',
});

const esewaInitiateResultSchema = z.object({
  payment_id: z.string().uuid(),
  transaction_uuid: z.string(),
  form_url: z.string().url(),
  form_fields: formFieldsSchema,
});

const verifyEsewaResponseSchema = z.object({
  payment_id: z.string().uuid(),
  status: z.enum(['succeeded', 'failed']),
  amount: z.string(),
});

const verifyEsewaSchema = z.object({
  transaction_uuid: z.string(),
  status: z.string(),
  total_amount: z.string(),
  ref_id: z.string().optional(),
  signed_field_names: z.string(),
  signature: z.string(),
}).passthrough();

registry.registerPath({
  method: 'post',
  path: '/api/v1/bills/{billId}/payment/esewa/initiate',
  tags: ['Payments', 'eSewa'],
  summary: 'Initiate eSewa payment for a bill',
  description:
    'Creates a pending payment and returns signed form fields for eSewa redirect. ' +
    'Guest can use this to pay their bill via eSewa. No authentication required (guest session).',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ billId: z.string().uuid() }),
    body: {
      content: {
        'application/json': { schema: z.object({ return_url: z.string().url() }) },
      },
    },
  },
  responses: {
    200: successResponse('eSewa payment initiated', esewaInitiateResultSchema),
    400: errorResponse('Validation error or bill not payable or eSewa not configured'),
    404: errorResponse('Bill not found'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/public/payments/esewa/verify',
  tags: ['Payments', 'eSewa'],
  summary: 'Verify eSewa payment callback',
  description:
    'Verifies eSewa payment callback signature and updates payment status. ' +
    'Called by eSewa after user completes payment.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: verifyEsewaSchema,
        },
      },
    },
  },
  responses: {
    200: successResponse('eSewa payment verified', verifyEsewaResponseSchema),
    400: errorResponse('Invalid signature or amount mismatch'),
    404: errorResponse('Payment not found'),
  },
});
