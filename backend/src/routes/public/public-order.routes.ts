import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import {
  getOrderController,
  placeOrderController,
} from '@/controllers/public/public-order.controller';
import { validate } from '@/middlewares/validate';
import { orderIdSchema, placeOrderSchema } from '@/validations/public/public-order.schema';
import { createRateLimiter } from '@/middlewares/rateLimit';
import { AppError } from '@/errors/AppError';

import './public-order.docs';

const publicOrderRouter = Router();

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