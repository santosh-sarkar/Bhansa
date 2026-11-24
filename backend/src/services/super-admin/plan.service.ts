import type { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';

export interface PlanDetail {
  id: string;
  code: string;
  name: string;
  price_monthly: string;
  max_outlets: number;
  max_staff: number | null;
  max_menu_items: number | null;
  multi_outlet_enabled: boolean;
  features: Record<string, unknown>;
  is_public: boolean;
  created_at: Date;
  subscription_count: number;
}

export interface PlanListItem {
  id: string;
  code: string;
  name: string;
  price_monthly: string;
  max_outlets: number;
  max_staff: number | null;
  max_menu_items: number | null;
  multi_outlet_enabled: boolean;
  is_public: boolean;
  subscription_count: number;
  created_at: Date;
}

export interface CreatePlanInput {
  code: string;
  name: string;
  price_monthly: string;
  max_outlets: number;
  max_staff: number | null;
  max_menu_items: number | null;
  multi_outlet_enabled: boolean;
  features?: Prisma.InputJsonValue;
  is_public: boolean;
}

export interface UpdatePlanInput {
  name?: string;
  price_monthly?: string;
  max_outlets?: number;
  max_staff?: number | null;
  max_menu_items?: number | null;
  multi_outlet_enabled?: boolean;
  features?: Prisma.InputJsonValue;
  is_public?: boolean;
}

/**
 * Lists all plans for Super Admin with subscription counts.
 */
export async function listPlans(): Promise<PlanListItem[]> {
  const plans = await prisma.plan.findMany({
    orderBy: { price_monthly: 'asc' },
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
  });

  return plans.map((plan) => ({
    id: plan.id,
    code: plan.code,
    name: plan.name,
    price_monthly: plan.price_monthly.toString(),
    max_outlets: plan.max_outlets,
    max_staff: plan.max_staff,
    max_menu_items: plan.max_menu_items,
    multi_outlet_enabled: plan.multi_outlet_enabled,
    is_public: plan.is_public,
    subscription_count: plan._count.subscriptions,
    created_at: plan.created_at,
  }));
}

/**
 * Gets a plan by ID for Super Admin.
 */
export async function getPlanById(planId: string): Promise<PlanDetail> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
  });

  if (!plan) {
    throw new AppError('NOT_FOUND', 'Plan not found', 404);
  }

  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    price_monthly: plan.price_monthly.toString(),
    max_outlets: plan.max_outlets,
    max_staff: plan.max_staff,
    max_menu_items: plan.max_menu_items,
    multi_outlet_enabled: plan.multi_outlet_enabled,
    features: (plan.features as Record<string, unknown>) ?? {},
    is_public: plan.is_public,
    created_at: plan.created_at,
    subscription_count: plan._count.subscriptions,
  };
}

/**
 * Creates a new plan (Super Admin only).
 */
export async function createPlan(input: CreatePlanInput): Promise<PlanDetail> {
  // Check if code already exists
  const existing = await prisma.plan.findUnique({
    where: { code: input.code },
  });

  if (existing) {
    throw new AppError('CONFLICT', 'Plan code already exists', 409);
  }

  const plan = await prisma.plan.create({
    data: {
      code: input.code,
      name: input.name,
      price_monthly: input.price_monthly,
      max_outlets: input.max_outlets,
      max_staff: input.max_staff,
      max_menu_items: input.max_menu_items,
      multi_outlet_enabled: input.multi_outlet_enabled,
      features: input.features ?? {},
      is_public: input.is_public,
    },
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
  });

  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    price_monthly: plan.price_monthly.toString(),
    max_outlets: plan.max_outlets,
    max_staff: plan.max_staff,
    max_menu_items: plan.max_menu_items,
    multi_outlet_enabled: plan.multi_outlet_enabled,
    features: (plan.features as Record<string, unknown>) ?? {},
    is_public: plan.is_public,
    created_at: plan.created_at,
    subscription_count: plan._count.subscriptions,
  };
}

/**
 * Updates a plan (Super Admin only).
 * Cannot change the code after creation.
 */
export async function updatePlan(planId: string, input: UpdatePlanInput): Promise<PlanDetail> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new AppError('NOT_FOUND', 'Plan not found', 404);
  }

  const updatedPlan = await prisma.plan.update({
    where: { id: planId },
    data: {
      name: input.name,
      price_monthly: input.price_monthly,
      max_outlets: input.max_outlets,
      max_staff: input.max_staff,
      max_menu_items: input.max_menu_items,
      multi_outlet_enabled: input.multi_outlet_enabled,
      features: input.features,
      is_public: input.is_public,
    },
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
  });

  return {
    id: updatedPlan.id,
    code: updatedPlan.code,
    name: updatedPlan.name,
    price_monthly: updatedPlan.price_monthly.toString(),
    max_outlets: updatedPlan.max_outlets,
    max_staff: updatedPlan.max_staff,
    max_menu_items: updatedPlan.max_menu_items,
    multi_outlet_enabled: updatedPlan.multi_outlet_enabled,
    features: (updatedPlan.features as Record<string, unknown>) ?? {},
    is_public: updatedPlan.is_public,
    created_at: updatedPlan.created_at,
    subscription_count: updatedPlan._count.subscriptions,
  };
}

/**
 * Deletes a plan (Super Admin only).
 * Only allowed if no active subscriptions are using it.
 */
export async function deletePlan(planId: string): Promise<{ success: boolean }> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      _count: {
        select: { subscriptions: true },
      },
    },
  });

  if (!plan) {
    throw new AppError('NOT_FOUND', 'Plan not found', 404);
  }

  if (plan._count.subscriptions > 0) {
    throw new AppError('CONFLICT', 'Cannot delete plan with active subscriptions', 409);
  }

  await prisma.plan.delete({
    where: { id: planId },
  });

  return { success: true };
}