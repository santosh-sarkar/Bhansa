import { z } from 'zod';

import { registry } from '@/swagger';

import { errorResponse, successResponse, paginatedResponseSchema } from '@/swagger/schemas/common';

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
  status: z.string(),
  total: z.string(),
  created_at: z.string().datetime(),
  paid_at: z.string().datetime().nullable(),
});

const billIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const listBillsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['pending', 'paid', 'cancelled', 'void']).optional(),
    outlet_id: z.string().uuid().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/bills',
  tags: ['Billing'],
  summary: 'Generate a bill for a session',
  description:
    'Generates a bill for the specified session, calculating totals including tax and service charge. ' +
    'Only allowed for sessions with completed orders. Requires payment.record permission.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: z.object({ session_id: z.string().uuid() }) },
      },
    },
  },
  responses: {
    201: successResponse('Bill generated', z.object({ bill: billDetailSchema })),
    400: errorResponse('Validation error or session has no completed orders'),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires payment.record permission'),
    404: errorResponse('Session not found or no completed orders'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/bills',
  tags: ['Billing'],
  summary: 'List bills',
  description:
    'Returns paginated list of bills with filters. Requires payment.record permission.',
  security: [{ bearerAuth: [] }],
  request: { query: listBillsSchema.shape.query },
  responses: {
    200: {
      description: 'Bills list',
      content: {
        'application/json': {
          schema: paginatedResponseSchema(billListItemSchema),
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires payment.record permission'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/bills/{id}',
  tags: ['Billing'],
  summary: 'Get bill details',
  description: 'Returns bill details with orders and items. Requires payment.record permission.',
  security: [{ bearerAuth: [] }],
  request: { params: billIdSchema.shape.params },
  responses: {
    200: successResponse('Bill details', z.object({ bill: billDetailSchema })),
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires payment.record permission'),
    404: errorResponse('Bill not found'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/bills/{id}/invoice',
  tags: ['Billing'],
  summary: 'Get bill invoice PDF',
  description: 'Returns a PDF invoice for the bill. Requires payment.record permission.',
  security: [{ bearerAuth: [] }],
  request: { params: billIdSchema.shape.params },
  responses: {
    200: {
      description: 'Bill invoice PDF',
      content: {
        'application/pdf': {
          schema: { type: 'string', format: 'binary' },
        },
      },
    },
    401: errorResponse('Unauthenticated'),
    403: errorResponse('Forbidden or requires payment.record permission'),
    404: errorResponse('Bill not found'),
  },
});
