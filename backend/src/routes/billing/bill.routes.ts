import { Router } from 'express';
import { z } from 'zod';

import { generateBillController, getBillController, listBillsController } from '@/controllers/billing/bill.controller';
import { registry } from '@/docs/openapi';
import { authMiddleware } from '@/middlewares/auth';
import { requireOrgPermission } from '@/middlewares/orgPermission';
import { validate } from '@/middlewares/validate';

const billRouter = Router();

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

const billDetailSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid(),
  outlet_name: z.string(),
  session_id: z.string().uuid().nullable(),
  table_id: z.string().uuid().nullable(),
  table_label: z.string().nullable(),
  invoice_number: z.string(),
  subtotal: z.string(),
  tax_amount: z.string(),
  service_charge: z.string(),
  discount_amount: z.string(),
  total: z.string(),
  status: z.string(),
  paid_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  cancelled_at: z.string().datetime().nullable(),
  cancelled_by: z.string().uuid().nullable(),
  cancel_reason: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  orders: z.array(
    z.object({
      id: z.string().uuid(),
      order_number: z.number().int(),
      status: z.string(),
      subtotal: z.string(),
      tax_amount: z.string(),
      discount_amount: z.string(),
      total: z.string(),
      created_at: z.string().datetime(),
      items: z.array(
        z.object({
          id: z.string().uuid(),
          menu_item_id: z.string().uuid(),
          item_name: z.string(),
          quantity: z.number().int(),
          unit_price: z.string(),
          line_total: z.string(),
          status: z.string(),
          options: z.unknown(),
          notes: z.string().nullable(),
        }),
      ),
    }),
  ),
});

const billListItemSchema = z.object({
  id: z.string().uuid(),
  outlet_id: z.string().uuid(),
  outlet_name: z.string(),
  session_id: z.string().uuid().nullable(),
  table_id: z.string().uuid().nullable(),
  table_label: z.string().nullable(),
  invoice_number: z.string(),
  subtotal: z.string(),
  tax_amount: z.string(),
  service_charge: z.string(),
  discount_amount: z.string(),
  total: z.string(),
  status: z.string(),
  paid_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  cancelled_at: z.string().datetime().nullable(),
  cancelled_by: z.string().uuid().nullable(),
  cancel_reason: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
});

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

registry.registerPath({
  method: 'post',
  path: '/api/v1/sessions/{id}/bill',
  tags: ['Billing'],
  summary: 'Generate bill for a session',
  description:
    'Generates a bill for a session with subtotal, VAT, service charge, and optional discount. Requires payment.record permission. Discount requires billing.manage permission.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: z.object({ discount_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional() }) } },
    },
  },
  responses: {
    200: successResponse('Bill generated', billDetailSchema),
    400: errorResponse('Validation error or no orders to bill'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or discount requires billing.manage permission'),
    404: errorResponse('Session not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/bills/{id}',
  tags: ['Billing'],
  summary: 'Get bill by ID',
  description: 'Returns detailed bill information including orders and items. Requires payment.record permission.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: successResponse('Bill details', billDetailSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
    404: errorResponse('Bill not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/bills',
  tags: ['Billing'],
  summary: 'List bills',
  description: 'Returns paginated list of bills with filters. Requires payment.record permission.',
  security: [{ cookieAuth: [] }],
  request: { query: listBillsSchema.shape.query },
  responses: {
    200: paginatedResponse('Bills list', billListItemSchema),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden'),
  },
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

export { billRouter };