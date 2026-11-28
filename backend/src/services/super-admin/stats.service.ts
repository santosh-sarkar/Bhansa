import { prisma } from '@/lib/prisma';

export interface MonthlyRevenue {
  month: string;
  amount: number;
}

export interface PlatformStats {
  organizations: {
    total: number;
    active: number;
    suspended: number;
    deleted: number;
  };
  subscriptions: {
    total: number;
    trialing: number;
    active: number;
    grace: number;
    suspended: number;
    cancelled: number;
  };
  plans: {
    total: number;
    public: number;
    subscription_distribution: Array<{
      plan_id: string;
      plan_code: string;
      plan_name: string;
      count: number;
    }>;
  };
  outlets: {
    total: number;
    active: number;
  };
  staff: {
    total: number;
    active: number;
    by_role: Array<{
      role: string;
      count: number;
    }>;
  };
  leads: {
    total: number;
    handled: number;
    unhandled: number;
  };
  revenue: {
    total_paid: number;
    this_month: number;
    pending: number;
    by_plan: Array<{
      plan_code: string;
      plan_name: string;
      amount: number;
    }>;
    total_all_time: number;
  };
  monthly_revenue: MonthlyRevenue[];
}

/**
 * Gets platform-wide statistics for Super Admin dashboard.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Organizations
  const [orgTotal, orgActive, orgSuspended, orgDeleted] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: 'active', deleted_at: null } }),
    prisma.organization.count({ where: { status: 'suspended' } }),
    prisma.organization.count({ where: { deleted_at: { not: null } } }),
  ]);

  // Subscriptions
  const [
    subTotal,
    subTrialing,
    subActive,
    subGrace,
    subSuspended,
    subCancelled,
    subDistribution,
  ] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: 'trialing' } }),
    prisma.subscription.count({ where: { status: 'active' } }),
    prisma.subscription.count({ where: { status: 'grace' } }),
    prisma.subscription.count({ where: { status: 'suspended' } }),
    prisma.subscription.count({ where: { status: 'cancelled' } }),
    prisma.subscription.groupBy({
      by: ['plan_id'],
      _count: { plan_id: true },
      where: { status: { in: ['trialing', 'active', 'grace'] } },
    }),
  ]);

  // Get plan details for distribution
  const planIds = subDistribution.map((d) => d.plan_id);
  const plans = await prisma.plan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, code: true, name: true },
  });

  const planMap = new Map(plans.map((p) => [p.id, p]));
  const subscriptionDistribution = subDistribution.map((d) => {
    const plan = planMap.get(d.plan_id);
    return {
      plan_id: d.plan_id,
      plan_code: plan?.code ?? 'unknown',
      plan_name: plan?.name ?? 'Unknown',
      count: d._count.plan_id,
    };
  });

  // Plans
  const [planTotal, planPublic] = await Promise.all([
    prisma.plan.count(),
    prisma.plan.count({ where: { is_public: true } }),
  ]);

  // Outlets
  const [outletTotal, outletActive] = await Promise.all([
    prisma.outlet.count(),
    prisma.outlet.count({ where: { is_active: true, deleted_at: null } }),
  ]);

  // Staff
  const [staffTotal, staffActive, staffByRole] = await Promise.all([
    prisma.user.count({ where: { organization_id: { not: null } } }),
    prisma.user.count({ where: { organization_id: { not: null }, is_active: true } }),
    prisma.staffAssignment.groupBy({
      by: ['role_id'],
      _count: { role_id: true },
    }),
  ]);

  // Get role names for staff distribution
  const roleIds = staffByRole.map((r) => r.role_id);
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { id: true, code: true },
  });
  const roleMap = new Map(roles.map((r) => [r.id, r.code]));
  const staffDistribution = staffByRole.map((r) => ({
    role: roleMap.get(r.role_id) ?? 'unknown',
    count: r._count.role_id,
  }));

  // Leads
  const [leadTotal, leadHandled, leadUnhandled] = await Promise.all([
    prisma.customPlanLead.count(),
    prisma.customPlanLead.count({ where: { handled: true } }),
    prisma.customPlanLead.count({ where: { handled: false } }),
  ]);

  // Revenue from successful subscription payments
  const [revenueTotal, revenueThisMonth, revenuePending, revenueByPlan, revenueAllTime] = await Promise.all([
    prisma.subscriptionPayment.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    }),
    prisma.subscriptionPayment.aggregate({
      where: {
        status: 'completed',
        created_at: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.subscriptionPayment.aggregate({
      where: { status: 'pending' },
      _sum: { amount: true },
    }),
    prisma.subscriptionPayment.groupBy({
      by: ['subscription_id'],
      _sum: { amount: true },
      where: { status: 'completed' },
    }),
    prisma.subscriptionPayment.findMany({
      where: { status: 'completed' },
      select: { amount: true, created_at: true },
      orderBy: { created_at: 'asc' },
    }),
  ]);

  // Get plan info for revenue by plan
  const subIds = revenueByPlan.map((r) => r.subscription_id);
  const subscriptions = await prisma.subscription.findMany({
    where: { id: { in: subIds } },
    select: { id: true, plan: { select: { code: true, name: true } } },
  });
  const subMap = new Map(subscriptions.map((s) => [s.id, s.plan]));
  const revenuePlanMap = new Map<string, { plan_code: string; plan_name: string; amount: number }>();

  for (const r of revenueByPlan) {
    const plan = subMap.get(r.subscription_id);
    if (plan) {
      const key = plan.code;
      const existing = revenuePlanMap.get(key);
      const amount = Number(r._sum.amount ?? 0);
      if (existing) {
        existing.amount += amount;
      } else {
        revenuePlanMap.set(key, {
          plan_code: plan.code,
          plan_name: plan.name,
          amount,
        });
      }
    }
  }

  const revenueByPlanArray = Array.from(revenuePlanMap.values());

  // Monthly revenue: last 12 months of completed payments
  const monthlyRevenue = new Map<string, number>();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const now2 = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now2.getFullYear(), now2.getMonth() - i, 1);
    monthlyRevenue.set(monthKey(d), 0);
  }
  for (const p of revenueAllTime) {
    const key = monthKey(new Date(p.created_at));
    if (monthlyRevenue.has(key)) {
      monthlyRevenue.set(key, (monthlyRevenue.get(key) ?? 0) + Number(p.amount));
    }
  }
  const monthlyRevenueArray = Array.from(monthlyRevenue.entries()).map(([month, amount]) => ({
    month,
    amount: Number(amount),
  }));

  const revenueTotalAmount = Number(revenueTotal._sum.amount ?? 0);
  const revenueThisMonthAmount = Number(revenueThisMonth._sum.amount ?? 0);
  const revenuePendingAmount = Number(revenuePending._sum.amount ?? 0);
  const revenueAllTimeAmount = Number(revenueAllTime.reduce((sum, p) => sum + Number(p.amount), 0));

  return {
    organizations: {
      total: orgTotal,
      active: orgActive,
      suspended: orgSuspended,
      deleted: orgDeleted,
    },
    subscriptions: {
      total: subTotal,
      trialing: subTrialing,
      active: subActive,
      grace: subGrace,
      suspended: subSuspended,
      cancelled: subCancelled,
    },
    plans: {
      total: planTotal,
      public: planPublic,
      subscription_distribution: subscriptionDistribution,
    },
    outlets: {
      total: outletTotal,
      active: outletActive,
    },
    staff: {
      total: staffTotal,
      active: staffActive,
      by_role: staffDistribution,
    },
    leads: {
      total: leadTotal,
      handled: leadHandled,
      unhandled: leadUnhandled,
    },
    revenue: {
      total_paid: revenueTotalAmount,
      this_month: revenueThisMonthAmount,
      pending: revenuePendingAmount,
      by_plan: revenueByPlanArray,
      total_all_time: revenueAllTimeAmount,
    },
    monthly_revenue: monthlyRevenueArray,
  };
}