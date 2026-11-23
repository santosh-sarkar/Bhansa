import { Router } from 'express';
import { z } from 'zod';

import { initiateEsewaPaymentController, verifyEsewaPaymentController } from '@/controllers/payment/esewa-initiate.controller';
import { registry } from '@/docs/openapi';
import { validate } from '@/middlewares/validate';

const esewaInitiateRouter = Router();

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

const esewaInitiateResultSchema = z.object({
  payment_id: z.string().uuid(),
  transaction_uuid: z.string(),
  form_url: z.string().url(),
  form_fields: z.record(z.string(), z.string()),
});

const initiateEsewaSchema = z.object({
  params: z.object({ billId: z.string().uuid() }),
  body: z.object({
    return_url: z.string().url(),
  }),
});

const verifyEsewaSchema = z.object({
  body: z.object({
    transaction_uuid: z.string(),
    status: z.string(),
    total_amount: z.string(),
    ref_id: z.string().optional(),
    signed_field_names: z.string(),
    signature: z.string(),
  }).passthrough(), // Allow additional fields from eSewa
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/bills/{billId}/payment/esewa/initiate',
  tags: ['Payments', 'eSewa'],
  summary: 'Initiate eSewa payment for a bill',
  description:
    'Creates a pending payment and returns signed form fields for eSewa redirect. ' +
    'Guest can use this to pay their bill via eSewa. No authentication required (guest session).',
  security: [{ cookieAuth: [] }],
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
          schema: z.object({
            transaction_uuid: z.string(),
            status: z.string(),
            total_amount: z.string(),
            ref_id: z.string().optional(),
            signed_field_names: z.string(),
            signature: z.string(),
          }).passthrough(),
        },
      },
    },
  },
  responses: {
    200: successResponse('eSewa payment verified', z.object({
      payment_id: z.string().uuid(),
      status: z.enum(['succeeded', 'failed']),
      amount: z.string(),
    })),
    400: errorResponse('Invalid signature or amount mismatch'),
    404: errorResponse('Payment not found'),
  },
});

// Guest routes - no authentication required (uses guest_token cookie for bill access)
esewaInitiateRouter.post(
  '/bills/{billId}/payment/esewa/initiate',
  validate({ params: initiateEsewaSchema.shape.params, body: initiateEsewaSchema.shape.body }),
  initiateEsewaPaymentController,
);

// eSewa callback verification - no authentication (called by eSewa)
esewaInitiateRouter.post(
  '/public/payments/esewa/verify',
  validate({ body: verifyEsewaSchema.shape.body }),
  verifyEsewaPaymentController,
);

export { esewaInitiateRouter };