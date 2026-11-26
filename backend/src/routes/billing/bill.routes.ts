import { Router } from 'express';
import { z } from 'zod';

import { generateBillController, getBillController, listBillsController } from '@/controllers/billing/bill.controller';
import { getBillInvoiceController } from '@/controllers/billing/invoice.controller';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

import './bill.docs';

const billRouter = Router();

// Validation schemas (inline)
const generateBillSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    discount_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  }),
});

const billIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const listBillsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['open', 'paid', 'cancelled']).optional(),
    outlet_id: z.string().uuid().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),
});

// All routes require authentication
billRouter.use(authMiddleware);

// Generate bill for a session - requires payment.record permission
billRouter.post(
  '/sessions/:id/bill',
  requireOrgPermission('payment.record'),
  validate({ params: generateBillSchema.shape.params, body: generateBillSchema.shape.body }),
  generateBillController,
);

// Get bill by ID - requires payment.record permission
billRouter.get(
  '/bills/:id',
  requireOrgPermission('payment.record'),
  validate({ params: billIdSchema.shape.params }),
  getBillController,
);

// List bills - requires payment.record permission
billRouter.get(
  '/bills',
  requireOrgPermission('payment.record'),
  validate({ query: listBillsSchema.shape.query }),
  listBillsController,
);

// Get printable invoice - requires payment.record permission
billRouter.get(
  '/bills/:id/invoice',
  requireOrgPermission('payment.record'),
  validate({ params: billIdSchema.shape.params }),
  getBillInvoiceController,
);

export { billRouter };