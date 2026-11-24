import { prisma } from '@/lib/prisma';
import { AppError } from '@/errors/AppError';

export interface UpdateSubscriptionOverridesInput {
  max_outlets_override: number | null;
  max_staff_override: number | null;
  max_menu_items_override: number | null;
}

export interface ExtendTrialInput {
  trial_ends_at: string; // ISO datetime string
}

export interface ChangePlanInput {
  plan_id: string;
  current_period_end?: string; // ISO datetime string, optional
}

export interface SubscriptionDetailForAdmin {
  id: string;
  organization_id: string;
  organization_name: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  status: string;
  trial_ends_at: Date | null;
  grace_ends_at: Date | null;
  current_period_end: Date | null;
  max_outlets_override: number | null;
  max_staff_override: number | null;
  max_menu_items_override: number | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Lists all subscriptions for Super Admin with organization and plan details.
 */
export async function listSubscriptions(): Promise<SubscriptionDetailForAdmin[]> {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
  });

  return subscriptions.map((sub) => ({
    id: sub.id,
    organization_id: sub.organization_id,
    organization_name: sub.organization.name,
    plan_id: sub.plan_id,
    plan_code: sub.plan.code,
    plan_name: sub.plan.name,
    status: sub.status,
    trial_ends_at: sub.trial_ends_at,
    grace_ends_at: sub.grace_ends_at,
    current_period_end: sub.current_period_end,
    max_outlets_override: sub.max_outlets_override,
    max_staff_override: sub.max_staff_override,
    max_menu_items_override: sub.max_menu_items_override,
    created_at: sub.created_at,
    updated_at: sub.updated_at,
  }));
}

/**
 * Gets a subscription by ID for Super Admin.
 */
export async function getSubscriptionById(subscriptionId: string): Promise<SubscriptionDetailForAdmin> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
  });

  if (!subscription) {
    throw new AppError('NOT_FOUND', 'Subscription not found', 404);
  }

  return {
    id: subscription.id,
    organization_id: subscription.organization_id,
    organization_name: subscription.organization.name,
    plan_id: subscription.plan_id,
    plan_code: subscription.plan.code,
    plan_name: subscription.plan.name,
    status: subscription.status,
    trial_ends_at: subscription.trial_ends_at,
    grace_ends_at: subscription.grace_ends_at,
    current_period_end: subscription.current_period_end,
    max_outlets_override: subscription.max_outlets_override,
    max_staff_override: subscription.max_staff_override,
    max_menu_items_override: subscription.max_menu_items_override,
    created_at: subscription.created_at,
    updated_at: subscription.updated_at,
  };
}

/**
 * Updates subscription overrides (Super Admin only).
 * Allows setting max_outlets_override, max_staff_override, max_menu_items_override to null (unlimited) or a positive integer.
 */
export async function updateSubscriptionOverrides(
  subscriptionId: string,
  input: UpdateSubscriptionOverridesInput
): Promise<SubscriptionDetailForAdmin> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
  });

  if (!subscription) {
    throw new AppError('NOT_FOUND', 'Subscription not found', 404);
  }

  // Validate overrides: null or positive integer
  if (input.max_outlets_override !== null && input.max_outlets_override < 0) {
    throw new AppError('VALIDATION_ERROR', 'max_outlets_override must be null or a non-negative integer', 400);
  }
  if (input.max_staff_override !== null && input.max_staff_override < 0) {
    throw new AppError('VALIDATION_ERROR', 'max_staff_override must be null or a non-negative integer', 400);
  }
  if (input.max_menu_items_override !== null && input.max_menu_items_override < 0) {
    throw new AppError('VALIDATION_ERROR', 'max_menu_items_override must be null or a non-negative integer', 400);
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      max_outlets_override: input.max_outlets_override,
      max_staff_override: input.max_staff_override,
      max_menu_items_override: input.max_menu_items_override,
    },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
  });

  return {
    id: updated.id,
    organization_id: updated.organization_id,
    organization_name: updated.organization.name,
    plan_id: updated.plan_id,
    plan_code: updated.plan.code,
    plan_name: updated.plan.name,
    status: updated.status,
    trial_ends_at: updated.trial_ends_at,
    grace_ends_at: updated.grace_ends_at,
    current_period_end: updated.current_period_end,
    max_outlets_override: updated.max_outlets_override,
    max_staff_override: updated.max_staff_override,
    max_menu_items_override: updated.max_menu_items_override,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  };
}

/**
 * Extends trial period for a subscription (Super Admin only).
 * Only allowed if subscription is in 'trialing' status.
 */
export async function extendTrial(
  subscriptionId: string,
  input: ExtendTrialInput
): Promise<SubscriptionDetailForAdmin> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
  });

  if (!subscription) {
    throw new AppError('NOT_FOUND', 'Subscription not found', 404);
  }

  if (subscription.status !== 'trialing') {
    throw new AppError('VALIDATION_ERROR', 'Can only extend trial for subscriptions in trialing status', 400);
  }

  const newTrialEndsAt = new Date(input.trial_ends_at);
  if (isNaN(newTrialEndsAt.getTime())) {
    throw new AppError('VALIDATION_ERROR', 'Invalid trial_ends_at date', 400);
  }

  if (newTrialEndsAt <= new Date()) {
    throw new AppError('VALIDATION_ERROR', 'trial_ends_at must be in the future', 400);
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      trial_ends_at: newTrialEndsAt,
    },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
  });

  return {
    id: updated.id,
    organization_id: updated.organization_id,
    organization_name: updated.organization.name,
    plan_id: updated.plan_id,
    plan_code: updated.plan.code,
    plan_name: updated.plan.name,
    status: updated.status,
    trial_ends_at: updated.trial_ends_at,
    grace_ends_at: updated.grace_ends_at,
    current_period_end: updated.current_period_end,
    max_outlets_override: updated.max_outlets_override,
    max_staff_override: updated.max_staff_override,
    max_menu_items_override: updated.max_menu_items_override,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  };
}

/**
 * Changes the plan for a subscription (Super Admin only).
 * Updates plan_id and optionally current_period_end.
 */
export async function changePlan(
  subscriptionId: string,
  input: ChangePlanInput
): Promise<SubscriptionDetailForAdmin> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
  });

  if (!subscription) {
    throw new AppError('NOT_FOUND', 'Subscription not found', 404);
  }

  // Verify new plan exists
  const newPlan = await prisma.plan.findUnique({
    where: { id: input.plan_id },
  });

  if (!newPlan) {
    throw new AppError('NOT_FOUND', 'Plan not found', 404);
  }

  // Validate current_period_end if provided
  let currentPeriodEnd: Date | null = subscription.current_period_end;
  if (input.current_period_end) {
    const parsed = new Date(input.current_period_end);
    if (isNaN(parsed.getTime())) {
      throw new AppError('VALIDATION_ERROR', 'Invalid current_period_end date', 400);
    }
    currentPeriodEnd = parsed;
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      plan_id: input.plan_id,
      current_period_end: currentPeriodEnd,
    },
    include: {
      organization: { select: { id: true, name: true } },
      plan: { select: { id: true, code: true, name: true } },
    },
  });

  return {
    id: updated.id,
    organization_id: updated.organization_id,
    organization_name: updated.organization.name,
    plan_id: updated.plan_id,
    plan_code: updated.plan.code,
    plan_name: updated.plan.name,
    status: updated.status,
    trial_ends_at: updated.trial_ends_at,
    grace_ends_at: updated.grace_ends_at,
    current_period_end: updated.current_period_end,
    max_outlets_override: updated.max_outlets_override,
    max_staff_override: updated.max_staff_override,
    max_menu_items_override: updated.max_menu_items_override,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  };
}