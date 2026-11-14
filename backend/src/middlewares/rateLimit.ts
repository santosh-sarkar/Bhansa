import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { redis } from '@/lib/redis';
import { AppError } from '@/errors/AppError';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const {
    windowMs,
    maxRequests,
    keyPrefix,
    keyGenerator = (req) => req.ip ?? 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  const windowSec = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `${keyPrefix}:${keyGenerator(req)}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, windowSec);
    }

    const ttl = await redis.ttl(key);
    const remaining = Math.max(0, maxRequests - current);
    const resetTime = Date.now() + ttl * 1000;

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    const shouldSkip =
      (skipSuccessfulRequests && res.statusCode < 400) ||
      (skipFailedRequests && res.statusCode >= 400);

    if (current > maxRequests && !shouldSkip) {
      res.setHeader('Retry-After', String(ttl));
      next(new AppError('RATE_LIMITED', 'Too many requests', 429));
      return;
    }

    next();
  };
}
