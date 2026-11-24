import type { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';

export interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  outlet_count: number;
  staff_count: number;
  subscription_status: string | null;
  subscription_plan: string | null;
  trial_ends_at: Date | null;
  grace_ends_at: Date | null;
  created_at: Date;
  deleted_at: Date | null;
}

export interface OrganizationDetail extends OrganizationListItem {
  outlets: Array<{
    id: string;
    name: string;
    is_active: boolean;
  }>;
  staff: Array<{
    id: string;
    email: string;
    full_name: string;
    is_active: boolean;
    role: string;
    outlet_id: string | null;
  }>;
  subscription: {
    id: string;
    status: string;
    plan_name: string;
    trial_ends_at: Date | null;
    grace_ends_at: Date | null;
    current_period_end: Date | null;
  } | null;
  custom_plan_lead: {
    id: string;
    contact_name: string;
    contact_email: string;
    outlet_count: number | null;
    handled: boolean;
    created_at: Date;
  } | null;
}

export interface ListOrganizationsFilters {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}

/**
 * Lists organizations for Super Admin with filters and pagination.
 */
export async function listOrganizations(
  filters: ListOrganizationsFilters,
): Promise<{
  organizations: OrganizationListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { page, limit, status, search } = filters;

  const where: Prisma.OrganizationWhereInput = {};

  if (status) {
    where.status = status as 'pending' | 'active' | 'suspended';
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        outlets: {
          select: { id: true },
          where: { deleted_at: null },
        },
        users: {
          select: { id: true },
          where: {
            is_active: true,
            staffAssignments: { some: {} },
          },
        },
        subscriptions: {
          select: {
            status: true,
            plan: { select: { name: true } },
            trial_ends_at: true,
            grace_ends_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    organizations: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      currency: org.currency,
      outlet_count: org.outlets.length,
      staff_count: org.users.length,
      subscription_status: org.subscriptions[0]?.status ?? null,
      subscription_plan: org.subscriptions[0]?.plan?.name ?? null,
      trial_ends_at: org.subscriptions[0]?.trial_ends_at ?? null,
      grace_ends_at: org.subscriptions[0]?.grace_ends_at ?? null,
      created_at: org.created_at,
      deleted_at: org.deleted_at,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Gets detailed organization information for Super Admin.
 */
export async function getOrganizationDetail(
  organizationId: string,
): Promise<OrganizationDetail> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      outlets: {
        select: {
          id: true,
          name: true,
          is_active: true,
        },
        orderBy: { name: 'asc' },
      },
      users: {
        where: { is_active: true },
        include: {
          staffAssignments: {
            select: {
              role: { select: { code: true } },
              outlet_id: true,
            },
          },
        },
        orderBy: { full_name: 'asc' },
      },
      subscriptions: {
        select: {
          id: true,
          status: true,
          plan: { select: { name: true } },
          trial_ends_at: true,
          grace_ends_at: true,
          current_period_end: true,
        },
        orderBy: { created_at: 'desc' },
        take: 1,
      },
      customPlanLeads: {
        select: {
          id: true,
          contact_name: true,
          contact_email: true,
          outlet_count: true,
          handled: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
  });

  if (!organization) {
    throw new AppError('NOT_FOUND', 'Organization not found', 404);
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    currency: organization.currency,
    outlet_count: organization.outlets.length,
    staff_count: organization.users.length,
    subscription_status: organization.subscriptions[0]?.status ?? null,
    subscription_plan: organization.subscriptions[0]?.plan?.name ?? null,
    trial_ends_at: organization.subscriptions[0]?.trial_ends_at ?? null,
    grace_ends_at: organization.subscriptions[0]?.grace_ends_at ?? null,
    created_at: organization.created_at,
    deleted_at: organization.deleted_at,
    outlets: organization.outlets,
    staff: organization.users.map((user) => {
      const assignment = user.staffAssignments[0];
      return {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_active: user.is_active,
        role: assignment?.role?.code ?? 'none',
        outlet_id: assignment?.outlet_id ?? null,
      };
    }),
    subscription: organization.subscriptions[0]
      ? {
          id: organization.subscriptions[0].id,
          status: organization.subscriptions[0].status,
          plan_name: organization.subscriptions[0].plan?.name ?? 'Unknown',
          trial_ends_at: organization.subscriptions[0].trial_ends_at,
          grace_ends_at: organization.subscriptions[0].grace_ends_at,
          current_period_end: organization.subscriptions[0].current_period_end,
        }
      : null,
    custom_plan_lead: organization.customPlanLeads[0] ?? null,
  };
}

/**
 * Suspends an organization (sets status to suspended).
 */
export async function suspendOrganization(
  organizationId: string,
): Promise<{ success: boolean }> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new AppError('NOT_FOUND', 'Organization not found', 404);
  }

  if (organization.status === 'suspended') {
    throw new AppError('VALIDATION_ERROR', 'Organization already suspended', 400);
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: 'suspended' },
  });

  return { success: true };
}

/**
 * Reactivates an organization (sets status to active).
 */
export async function reactivateOrganization(
  organizationId: string,
): Promise<{ success: boolean }> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new AppError('NOT_FOUND', 'Organization not found', 404);
  }

  if (organization.status === 'active') {
    throw new AppError('VALIDATION_ERROR', 'Organization already active', 400);
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: 'active' },
  });

  return { success: true };
}

/**
 * Soft deletes an organization (sets deleted_at timestamp).
 */
export async function deleteOrganization(
  organizationId: string,
): Promise<{ success: boolean }> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new AppError('NOT_FOUND', 'Organization not found', 404);
  }

  if (organization.deleted_at) {
    throw new AppError('VALIDATION_ERROR', 'Organization already deleted', 400);
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { deleted_at: new Date(), status: 'suspended' },
  });

  return { success: true };
}