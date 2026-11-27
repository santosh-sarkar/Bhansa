import { Router } from 'express';
import { z } from 'zod';

import { initiateEsewaPaymentController, verifyEsewaPaymentController } from '@/controllers/payment/esewa-initiate.controller';
import { validate } from '@/middlewares/validate';

const esewaInitiateRouter = Router();

// Validation schemas (inline)
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
  }).passthrough(),
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