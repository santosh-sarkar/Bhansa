import type { Request, Response, NextFunction } from 'express';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getLimits } from '@/services/plans/plan.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export interface SubscriptionGuardRequest extends Request {
  subscriptionStatus?: string;
  subscriptionLimits?: Awaited<ReturnType<typeof getLimits>>;
}

async function getSubscription(organizationId: string) {
  // First check for active subscriptions (trialing/active/grace)
  const activeSub = await prisma.subscription.findFirst({
    where: {
      organization_id: organizationId,
      status: { in: ['trialing', 'active', 'grace'] },
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      status: true,
      plan: { select: { code: true } },
      trial_ends_at: true,
      grace_ends_at: true,
      current_period_end: true,
    },
  });

  if (activeSub) {
    return activeSub;
  }

  // Check for suspended/cancelled subscriptions
  const suspendedSub = await prisma.subscription.findFirst({
    where: {
      organization_id: organizationId,
      status: { in: ['suspended', 'cancelled'] },
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      status: true,
      plan: { select: { code: true } },
    },
  });

  return suspendedSub;
}

export async function subscriptionGuardMiddleware(
  req: SubscriptionGuardRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.user should be set by authMiddleware
    if (!req.user || !req.user.organization_id) {
      // No organization context — let downstream handle or apply restrictive defaults
      const restrictiveLimits = await getLimits('00000000-0000-0000-0000-000000000000');
      req.subscriptionStatus = 'none';
      req.subscriptionLimits = restrictiveLimits;
      return next();
    }

    const subscription = await getSubscription(req.user.organization_id);

    if (!subscription) {
      // No active subscription — restrictive defaults
      const restrictiveLimits = await getLimits(req.user.organization_id);
      req.subscriptionStatus = 'none';
      req.subscriptionLimits = restrictiveLimits;
    } else {
      req.subscriptionStatus = subscription.status;
      req.subscriptionLimits = await getLimits(req.user.organization_id);
    }

    // Grace period: read-only — block mutating methods
    if (req.subscriptionStatus === 'grace' && MUTATING_METHODS.has(req.method)) {
      throw new AppError(
        'SUBSCRIPTION_READ_ONLY',
        'Your trial has expired. You are in a 7-day read-only grace period. Please upgrade to continue making changes.',
        403,
      );
    }

    // Suspended or cancelled: block all access
    if (req.subscriptionStatus === 'suspended' || req.subscriptionStatus === 'cancelled') {
      throw new AppError(
        'SUBSCRIPTION_SUSPENDED',
        'Your subscription is suspended. Please contact support or upgrade your plan.',
        403,
      );
    }

    // No subscription at all: block mutations, allow reads for now
    if (req.subscriptionStatus === 'none' && MUTATING_METHODS.has(req.method)) {
      throw new AppError(
        'FORBIDDEN',
        'No active subscription found. Please set up a plan to continue.',
        403,
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function skipSubscriptionGuard() {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}
