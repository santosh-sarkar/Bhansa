import { Router } from 'express';
import { z } from 'zod';

import {
  submitSubscriptionPaymentController,
  reviewSubscriptionPaymentController,
  getSubscriptionPaymentController,
  listSubscriptionPaymentsController,
} from '@/controllers/plans/subscription-payment.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission, requireSuperAdmin } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

import './subscription-payment.docs';

const subscriptionPaymentRouter = Router();

// Validation schemas (inline)
const submitSubscriptionPaymentSchema = z.object({
  body: z.object({
    subscription_id: z.string().uuid(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    reference: z.string().min(1).max(128),
    period_months: z.coerce.number().int().positive().default(1),
  }),
});

const reviewSubscriptionPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    action: z.enum(['approve', 'reject']),
  }),
});

const subscriptionPaymentIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const listSubscriptionPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['submitted', 'approved', 'rejected']).optional(),
    organization_id: z.string().uuid().optional(),
  }),
});

// All routes require authentication
subscriptionPaymentRouter.use(authMiddleware);

// Owner submits payment reference - requires billing.manage permission
subscriptionPaymentRouter.post(
  '/subscription/payments',
  requireOrgPermission('billing.manage'),
  validate({ body: submitSubscriptionPaymentSchema.shape.body }),
  submitSubscriptionPaymentController,
);

// Super Admin reviews payment - requires Super Admin role
subscriptionPaymentRouter.post(
  '/subscription/payments/{id}/review',
  requireSuperAdmin(),
  validate({ params: reviewSubscriptionPaymentSchema.shape.params, body: reviewSubscriptionPaymentSchema.shape.body }),
  reviewSubscriptionPaymentController,
);

// Get payment by ID - requires billing.manage permission
subscriptionPaymentRouter.get(
  '/subscription/payments/{id}',
  requireOrgPermission('billing.manage'),
  validate({ params: subscriptionPaymentIdSchema.shape.params }),
  getSubscriptionPaymentController,
);

// List payments - requires billing.manage permission
subscriptionPaymentRouter.get(
  '/subscription/payments',
  requireOrgPermission('billing.manage'),
  validate({ query: listSubscriptionPaymentsSchema.shape.query }),
  listSubscriptionPaymentsController,
);

export { subscriptionPaymentRouter };