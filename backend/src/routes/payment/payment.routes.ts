import { Router } from 'express';
import { z } from 'zod';

import { recordCashPaymentController, getPaymentController, listPaymentsController } from '@/controllers/payment/payment.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

import './payment.docs';

const paymentRouter = Router();

// Validation schemas (inline)
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