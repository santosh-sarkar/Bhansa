import { prisma } from '@/lib/prisma';

export interface EffectiveLimits {
  maxOutlets: number;
  maxStaff: number | null;
  maxMenuItems: number | null;
  multiOutletEnabled: boolean;
  features: Record<string, unknown>;
}

export interface PlanWithSubscription {
  plan: {
    max_outlets: number;
    max_staff: number | null;
    max_menu_items: number | null;
    multi_outlet_enabled: boolean;
    features: Record<string, unknown>;
  };
  subscription: {
    max_outlets_override: number | null;
    max_staff_override: number | null;
    max_menu_items_override: number | null;
    status: string;
  } | null;
}

/**
 * Returns the effective limits for an organization by merging the plan's
 * base values with any subscription overrides.
 *
 * If there is no active subscription (e.g., organization is suspended),
 * the plan's base limits are returned (which may be restrictive).
 */
export async function getLimits(organizationId: string): Promise<EffectiveLimits> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      subscriptions: {
        where: { status: { in: ['trialing', 'active', 'grace'] } },
        take: 1,
        orderBy: { created_at: 'desc' },
        select: {
          max_outlets_override: true,
          max_staff_override: true,
          max_menu_items_override: true,
          status: true,
          plan: {
            select: {
              max_outlets: true,
              max_staff: true,
              max_menu_items: true,
              multi_outlet_enabled: true,
              features: true,
            },
          },
        },
      },
    },
  });

  if (!org || !org.subscriptions || org.subscriptions.length === 0) {
    // Fallback: no active subscription — return restrictive defaults
    return {
      maxOutlets: 0,
      maxStaff: 0,
      maxMenuItems: 0,
      multiOutletEnabled: false,
      features: {},
    };
  }

  const sub = org.subscriptions[0]!;
  const plan = sub.plan;
  const effectiveMaxOutlets = sub.max_outlets_override ?? plan.max_outlets;
  const effectiveMaxStaff = sub.max_staff_override ?? plan.max_staff;
  const effectiveMaxMenuItems = sub.max_menu_items_override ?? plan.max_menu_items;

  return {
    maxOutlets: effectiveMaxOutlets,
    maxStaff: effectiveMaxStaff,
    maxMenuItems: effectiveMaxMenuItems,
    multiOutletEnabled: plan.multi_outlet_enabled,
    features: (plan.features as Record<string, unknown>) ?? {},
  };
}

/**
 * Checks whether an organization can create another outlet.
 * Returns true if the current outlet count is less than the effective limit.
 */
export async function canCreateOutlet(organizationId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  const limits = await getLimits(organizationId);

  if (limits.maxOutlets <= 0) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const currentOutlets = await prisma.outlet.count({
    where: { organization_id: organizationId, deleted_at: null },
  });

  return {
    allowed: currentOutlets < limits.maxOutlets,
    current: currentOutlets,
    limit: limits.maxOutlets,
  };
}

/**
 * Checks whether an organization can add another staff member.
 * Returns true if the current staff count is less than the effective limit.
 * If maxStaff is null, it means unlimited (no restriction).
 */
export async function canAddStaff(organizationId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number | null;
}> {
  const limits = await getLimits(organizationId);

  if (limits.maxStaff !== null && limits.maxStaff <= 0) {
    return { allowed: false, current: 0, limit: limits.maxStaff };
  }

  const currentStaff = await prisma.user.count({
    where: {
      organization_id: organizationId,
      is_active: true,
      staffAssignments: { some: {} },
    },
  });

  const allowed = limits.maxStaff === null || currentStaff < limits.maxStaff;

  return {
    allowed,
    current: currentStaff,
    limit: limits.maxStaff,
  };
}

/**
 * Checks whether an organization can add another menu item.
 * Returns true if the current menu item count is less than the effective limit.
 * If maxMenuItems is null, it means unlimited (no restriction).
 */
export async function canAddMenuItem(organizationId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number | null;
}> {
  const limits = await getLimits(organizationId);

  if (limits.maxMenuItems !== null && limits.maxMenuItems <= 0) {
    return { allowed: false, current: 0, limit: limits.maxMenuItems };
  }

  const currentMenuItems = await prisma.menuItem.count({
    where: { organization_id: organizationId, deleted_at: null },
  });

  const allowed = limits.maxMenuItems === null || currentMenuItems < limits.maxMenuItems;

  return {
    allowed,
    current: currentMenuItems,
    limit: limits.maxMenuItems,
  };
}
