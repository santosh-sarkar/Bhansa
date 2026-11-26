import { Router } from 'express';

import {
  getCurrentSessionController,
  requestBillPublicController,
  startTableSessionController,
} from '@/controllers/public/public-session.controller';
import { validate } from '@/middlewares/validate';
import { requestBillSchema, startSessionSchema } from '@/validations/public/public-session.schema';
import { createRateLimiter } from '@/middlewares/rateLimit';

import './public-session.docs';

const publicSessionRouter = Router();

// Rate limiters for public session endpoints
const sessionStartRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute per IP
  keyPrefix: 'public:session:start:ip',
  keyGenerator: (req) => req.ip ?? 'unknown',
});

const sessionStartByQrRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute per QR token
  keyPrefix: 'public:session:start:qr',
  keyGenerator: (req) =>
    (req.body as { qrToken?: string } | undefined)?.qrToken ?? req.ip ?? 'unknown',
});

const currentSessionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute per session
  keyPrefix: 'public:session:current',
  keyGenerator: (req) => {
    const cookies = req.cookies as Record<string, string | undefined>;
    return cookies['guest_token'] ?? req.ip ?? 'unknown';
  },
});

const requestBillRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute per session
  keyPrefix: 'public:session:bill',
  keyGenerator: (req) => {
    const cookies = req.cookies as Record<string, string | undefined>;
    return cookies['guest_token'] ?? req.ip ?? 'unknown';
  },
});

// Public routes - no authentication required for starting session
publicSessionRouter.post(
  '/sessions',
  sessionStartRateLimiter,
  sessionStartByQrRateLimiter,
  validate({ body: startSessionSchema.shape.body }),
  startTableSessionController,
);

// Guest-only route - requires guest token cookie
publicSessionRouter.get(
  '/sessions/current',
  currentSessionRateLimiter,
  getCurrentSessionController,
);

// Guest bill request - requires guest token cookie
publicSessionRouter.post(
  '/sessions/current/bill-request',
  requestBillRateLimiter,
  validate({ body: requestBillSchema.shape.body }),
  requestBillPublicController,
);

export { publicSessionRouter };