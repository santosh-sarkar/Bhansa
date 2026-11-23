import type { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import type { StaffActor } from '@/services/staff/access';

export interface SubscriptionPaymentDetail {
  id: string;
  organization_id: string;
  subscription_id: string;
  amount: string;
  reference: string;
  status: string;
  period_months: number;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  subscription: {
    id: string;
    status: string;
    plan: {
      name: string;
      price_monthly: string;
    };
  };
}

export interface SubscriptionPaymentListItem {
  id: string;
  organization_id: string;
  subscription_id: string;
  amount: string;
  reference: string;
  status: string;
  period_months: number;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

/**
 * Owner submits a subscription payment reference.
 * Creates a pending subscription payment record.
 */
export async function submitSubscriptionPayment(
  actor: StaffActor,
  input: {
    subscription_id: string;
    amount: Prisma.Decimal;
    reference: string;
    period_months?: number;
  },
): Promise<SubscriptionPaymentDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify subscription belongs to the organization
  const subscription = await prisma.subscription.findUnique({
    where: { id: input.subscription_id },
    select: { id: true, organization_id: true, status: true, plan: { select: { name: true, price_monthly: true } } },
  });

  if (!subscription) {
    throw new AppError('NOT_FOUND', 'Subscription not found', 404);
  }

  if (subscription.organization_id !== actor.organization_id) {
    throw new AppError('NOT_FOUND', 'Subscription not found', 404);
  }

  // Check if subscription is in a state that allows renewal
  if (!['active', 'grace', 'suspended'].includes(subscription.status)) {
    throw new AppError('VALIDATION_ERROR', 'Subscription cannot be renewed in current state', 400);
  }

  // Check for existing pending payment for this subscription
  const existingPending = await prisma.subscriptionPayment.findFirst({
    where: {
      subscription_id: input.subscription_id,
      status: 'submitted',
    },
  });

  if (existingPending) {
    throw new AppError('CONFLICT', 'A pending payment already exists for this subscription', 409);
  }

  // Create subscription payment record
  const payment = await prisma.subscriptionPayment.create({
    data: {
      organization_id: actor.organization_id,
      subscription_id: input.subscription_id,
      amount: input.amount,
      reference: input.reference,
      status: 'submitted',
      period_months: input.period_months ?? 1,
    },
    include: {
      subscription: {
        include: {
          plan: { select: { name: true, price_monthly: true } },
        },
      },
    },
  });

  return {
    id: payment.id,
    organization_id: payment.organization_id,
    subscription_id: payment.subscription_id,
    amount: payment.amount.toString(),
    reference: payment.reference,
    status: payment.status,
    period_months: payment.period_months,
    reviewed_by: payment.reviewed_by,
    reviewed_at: payment.reviewed_at,
    created_at: payment.created_at,
    subscription: {
      id: payment.subscription.id,
      status: payment.subscription.status,
      plan: {
        name: payment.subscription.plan.name,
        price_monthly: payment.subscription.plan.price_monthly.toString(),
      },
    },
  };
}

/**
 * Super Admin reviews a subscription payment (approve or reject).
 */
export async function reviewSubscriptionPayment(
  actor: StaffActor,
  paymentId: string,
  action: 'approve' | 'reject',
): Promise<SubscriptionPaymentDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Check if user is super admin
  if (!actor.is_super_admin) {
    throw new AppError('FORBIDDEN', 'Super Admin access required', 403);
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: {
      subscription: {
        include: {
          plan: { select: { name: true, price_monthly: true } },
        },
      },
    },
  });

  if (!payment) {
    throw new AppError('NOT_FOUND', 'Subscription payment not found', 404);
  }

  if (payment.status !== 'submitted') {
    throw new AppError('VALIDATION_ERROR', 'Payment already reviewed', 400);
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const updatedPayment = await prisma.$transaction(async (tx) => {
    // Update payment status
    const updated = await tx.subscriptionPayment.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        reviewed_by: actor.id,
        reviewed_at: new Date(),
      },
      include: {
        subscription: {
          include: {
            plan: { select: { name: true, price_monthly: true } },
          },
        },
      },
    });

    // If approved, extend the subscription
    if (action === 'approve') {
      const subscription = await tx.subscription.findUnique({
        where: { id: payment.subscription_id },
        select: { current_period_end: true, status: true },
      });

      if (!subscription) {
        throw new AppError('NOT_FOUND', 'Subscription not found', 404);
      }

      // Calculate new period end date
      const baseDate = subscription.current_period_end && subscription.current_period_end > new Date()
        ? new Date(subscription.current_period_end)
        : new Date();

      const periodMonths = payment.period_months || 1;
      const newPeriodEnd = new Date(baseDate);
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + periodMonths);

      // Update subscription
      await tx.subscription.update({
        where: { id: payment.subscription_id },
        data: {
          status: 'active',
          current_period_end: newPeriodEnd,
          // Clear grace period if any
          grace_ends_at: null,
        },
      });
    }

    return updated;
  });

  return {
    id: updatedPayment.id,
    organization_id: updatedPayment.organization_id,
    subscription_id: updatedPayment.subscription_id,
    amount: updatedPayment.amount.toString(),
    reference: updatedPayment.reference,
    status: updatedPayment.status,
    period_months: updatedPayment.period_months,
    reviewed_by: updatedPayment.reviewed_by,
    reviewed_at: updatedPayment.reviewed_at,
    created_at: updatedPayment.created_at,
    subscription: {
      id: updatedPayment.subscription.id,
      status: updatedPayment.subscription.status,
      plan: {
        name: updatedPayment.subscription.plan.name,
        price_monthly: updatedPayment.subscription.plan.price_monthly.toString(),
      },
    },
  };
}

/**
 * Gets a subscription payment by ID.
 */
export async function getSubscriptionPaymentById(
  actor: StaffActor,
  paymentId: string,
): Promise<SubscriptionPaymentDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: {
      subscription: {
        include: {
          plan: { select: { name: true, price_monthly: true } },
        },
      },
    },
  });

  if (!payment) {
    throw new AppError('NOT_FOUND', 'Subscription payment not found', 404);
  }

  // Owner can only see their own organization's payments
  if (!actor.is_super_admin && payment.organization_id !== actor.organization_id) {
    throw new AppError('FORBIDDEN', 'No access to this payment', 403);
  }

  return {
    id: payment.id,
    organization_id: payment.organization_id,
    subscription_id: payment.subscription_id,
    amount: payment.amount.toString(),
    reference: payment.reference,
    status: payment.status,
    period_months: payment.period_months,
    reviewed_by: payment.reviewed_by,
    reviewed_at: payment.reviewed_at,
    created_at: payment.created_at,
    subscription: {
      id: payment.subscription.id,
      status: payment.subscription.status,
      plan: {
        name: payment.subscription.plan.name,
        price_monthly: payment.subscription.plan.price_monthly.toString(),
      },
    },
  };
}

/**
 * Lists subscription payments with filters.
 */
export async function listSubscriptionPayments(
  actor: StaffActor,
  filters: {
    page: number;
    limit: number;
    status?: string;
    organization_id?: string;
  },
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const isSuperAdmin = actor.is_super_admin;

  const where: Prisma.SubscriptionPaymentWhereInput = isSuperAdmin
    ? {}
    : { organization_id: actor.organization_id };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.organization_id) {
    if (!isSuperAdmin && filters.organization_id !== actor.organization_id) {
      throw new AppError('FORBIDDEN', 'No access to this organization', 403);
    }
    where.organization_id = filters.organization_id;
  }

  const [payments, total] = await Promise.all([
    prisma.subscriptionPayment.findMany({
      where,
      include: {
        subscription: {
          include: {
            plan: { select: { name: true, price_monthly: true } },
          },
        },
        organization: {
          select: { name: true },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.subscriptionPayment.count({ where }),
  ]);

  return {
    payments: payments.map((payment) => ({
      id: payment.id,
      organization_id: payment.organization_id,
      organization_name: payment.organization?.name ?? null,
      subscription_id: payment.subscription_id,
      amount: payment.amount.toString(),
      reference: payment.reference,
      status: payment.status,
      period_months: payment.period_months,
      reviewed_by: payment.reviewed_by,
      reviewed_at: payment.reviewed_at,
      created_at: payment.created_at,
    })),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}