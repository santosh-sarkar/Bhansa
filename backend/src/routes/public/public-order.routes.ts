import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import {
  getOrderController,
  placeOrderController,
} from '@/controllers/public/public-order.controller';
import { registry } from '@/docs/openapi';
import { validate } from '@/middlewares/validate';
import { orderIdSchema, placeOrderSchema } from '@/validations/public/public-order.schema';
import { createRateLimiter } from '@/middlewares/rateLimit';
import { AppError } from '@/errors/AppError';

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

// Rate limiters for public order endpoints
const orderPlaceRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 orders per minute per IP
  keyPrefix: 'public:order:place:ip',
  keyGenerator: (req) => req.ip ?? 'unknown',
});

const orderPlaceBySessionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 orders per minute per session
  keyPrefix: 'public:order:place:session',
  keyGenerator: (req) => {
    const cookies = req.cookies as Record<string, string | undefined>;
    return cookies['guest_token'] ?? req.ip ?? 'unknown';
  },
});

const orderGetRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute per session
  keyPrefix: 'public:order:get',
  keyGenerator: (req) => {
    const cookies = req.cookies as Record<string, string | undefined>;
    return cookies['guest_token'] ?? req.ip ?? 'unknown';
  },
});

// Cart size validation middleware
const cartSizeValidator = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const { items } = req.body as { items: Array<{ quantity: number }> };

    if (!items || !Array.isArray(items)) {
      next();
      return;
    }

    // Max items per order
    const MAX_ITEMS = 50;
    if (items.length > MAX_ITEMS) {
      next(new AppError('VALIDATION_ERROR', `Maximum ${MAX_ITEMS} items allowed per order`, 400));
      return;
    }

    // Max quantity per item
    const MAX_QUANTITY = 20;
    for (const item of items) {
      if (item.quantity > MAX_QUANTITY) {
        next(new AppError('VALIDATION_ERROR', `Maximum quantity per item is ${MAX_QUANTITY}`, 400));
        return;
      }
    }

    // Total quantity limit
    const MAX_TOTAL_QUANTITY = 100;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity > MAX_TOTAL_QUANTITY) {
      next(
        new AppError(
          'VALIDATION_ERROR',
          `Maximum total quantity per order is ${MAX_TOTAL_QUANTITY}`,
          400,
        ),
      );
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Public routes - require guest_token cookie
publicOrderRouter.post(
  '/orders',
  orderPlaceRateLimiter,
  orderPlaceBySessionRateLimiter,
  validate({ body: placeOrderSchema.shape.body }),
  cartSizeValidator,
  placeOrderController,
);

publicOrderRouter.get(
  '/orders/:id',
  orderGetRateLimiter,
  validate({ params: orderIdSchema.shape.params }),
  getOrderController,
);

export { publicOrderRouter };
