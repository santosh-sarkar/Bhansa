import { prisma } from '@/lib/prisma';
import { getLimits } from '@/services/plans/plan.service';
import { AppError } from '@/errors/AppError';

export interface SubscriptionDetail {
  id: string;
  status: string;
  plan: {
    id: string;
    code: string;
    name: string;
    price_monthly: string;
    currency: string;
    max_outlets: number;
    max_staff: number | null;
    max_menu_items: number | null;
    multi_outlet_enabled: boolean;
    features: Record<string, unknown>;
  };
  trial_ends_at: Date | null;
  grace_ends_at: Date | null;
  current_period_end: Date | null;
  max_outlets_override: number | null;
  max_staff_override: number | null;
  max_menu_items_override: number | null;
  usage: {
    outlets: { current: number; limit: number };
    staff: { current: number; limit: number | null };
    menu_items: { current: number; limit: number | null };
  };
}

export async function getSubscriptionDetail(organizationId: string): Promise<SubscriptionDetail> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      organization_id: organizationId,
      status: { in: ['trialing', 'active', 'grace'] },
    },
    orderBy: { created_at: 'desc' },
    include: {
      plan: true,
    },
  });

  if (!subscription) {
    throw new AppError('NOT_FOUND', 'No active subscription found', 404);
  }

  const limits = await getLimits(organizationId);

  // Count actual usage
  const [outletCount, staffCount, menuItemCount] = await Promise.all([
    prisma.outlet.count({ where: { organization_id: organizationId, deleted_at: null } }),
    prisma.user.count({
      where: {
        organization_id: organizationId,
        is_active: true,
        staffAssignments: { some: {} },
      },
    }),
    prisma.menuItem.count({ where: { organization_id: organizationId, deleted_at: null } }),
  ]);

  return {
    id: subscription.id,
    status: subscription.status,
    plan: {
      id: subscription.plan.id,
      code: subscription.plan.code,
      name: subscription.plan.name,
      price_monthly: subscription.plan.price_monthly.toString(),
      currency: subscription.plan.currency,
      max_outlets: subscription.plan.max_outlets,
      max_staff: subscription.plan.max_staff,
      max_menu_items: subscription.plan.max_menu_items,
      multi_outlet_enabled: subscription.plan.multi_outlet_enabled,
      features: (subscription.plan.features as Record<string, unknown>) ?? {},
    },
    trial_ends_at: subscription.trial_ends_at,
    grace_ends_at: subscription.grace_ends_at,
    current_period_end: subscription.current_period_end,
    max_outlets_override: subscription.max_outlets_override,
    max_staff_override: subscription.max_staff_override,
    max_menu_items_override: subscription.max_menu_items_override,
    usage: {
      outlets: { current: outletCount, limit: limits.maxOutlets },
      staff: { current: staffCount, limit: limits.maxStaff },
      menu_items: { current: menuItemCount, limit: limits.maxMenuItems },
    },
  };
}
