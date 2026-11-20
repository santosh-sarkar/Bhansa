import { Router } from 'express';
import { z } from 'zod';

import {
  getOrderController,
  placeOrderController,
} from '@/controllers/public/public-order.controller';
import { registry } from '@/docs/openapi';
import { validate } from '@/middlewares/validate';
import { orderIdSchema, placeOrderSchema } from '@/validations/public/public-order.schema';

const publicOrderRouter = Router();

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

const orderItemSchema = z.object({
  id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int(),
  unit_price: z.string(),
  total_price: z.string(),
  status: z.string(),
});

const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.number().int(),
  status: z.string(),
  subtotal: z.string(),
  tax_amount: z.string(),
  discount_amount: z.string(),
  total: z.string(),
  created_at: z.string().datetime(),
  confirmed_at: z.string().datetime().nullable().optional(),
  items: z.array(orderItemSchema),
});

const sessionSchema = z.object({
  id: z.string().uuid(),
  table_id: z.string().uuid(),
  outlet_id: z.string().uuid(),
});

const placeOrderResponseSchema = z.object({
  order: orderSchema,
  session: sessionSchema,
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/public/orders',
  tags: ['Public'],
  summary: 'Place a new order (guest)',
  description:
    'Creates a new order for the current guest session. Validates items against effective menu, ' +
    'calculates pricing server-side (including tax and service charge), and creates order with ' +
    'pending_confirmation status. Requires idempotency key to prevent duplicate orders. ' +
    'Requires guest_token cookie from POST /api/v1/public/sessions.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: placeOrderSchema.shape.body },
      },
    },
  },
  responses: {
    201: successResponse('Order created', placeOrderResponseSchema),
    400: errorResponse('Validation error or session not open'),
    401: errorResponse('No active session (missing or invalid guest_token cookie)'),
    404: errorResponse('Menu item not found or not available'),
    409: errorResponse('Idempotency key conflict - order already exists'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/public/orders/{id}',
  tags: ['Public'],
  summary: 'Get order details (guest)',
  description:
    'Returns order details for the current guest session. Only returns orders belonging to the session ' +
    'identified by the guest_token cookie.',
  security: [{ cookieAuth: [] }],
  request: {
    params: orderIdSchema.shape.params,
  },
  responses: {
    200: successResponse('Order details', z.object({ order: orderSchema })),
    401: errorResponse('No active session'),
    404: errorResponse('Order not found or not in current session'),
  },
});

// Public routes - require guest_token cookie
publicOrderRouter.post(
  '/orders',
  validate({ body: placeOrderSchema.shape.body }),
  placeOrderController,
);

publicOrderRouter.get(
  '/orders/:id',
  validate({ params: orderIdSchema.shape.params }),
  getOrderController,
);

export { publicOrderRouter };
