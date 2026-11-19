import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import {
  getAccessibleOutletIds,
  getManageableOutletIds,
  type StaffActor,
} from '@/services/staff/access';

export interface OutletListItem {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  tax_percent: string;
  service_charge_percent: string;
  is_active: boolean;
  created_at: Date;
}

export interface OutletDetail extends OutletListItem {
  organization_id: string;
}

export interface PaginatedOutlets {
  outlets: OutletListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Converts Prisma Decimal to string with 2 decimal places for tax and service charge percentages.
 */
function mapOutlet(outlet: {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  tax_percent: { toString(): string };
  service_charge_percent: { toString(): string };
  is_active: boolean;
  created_at: Date;
  organization_id?: string;
}): OutletListItem {
  return {
    id: outlet.id,
    name: outlet.name,
    address: outlet.address,
    phone: outlet.phone,
    timezone: outlet.timezone,
    tax_percent: parseFloat(outlet.tax_percent.toString()).toFixed(2),
    service_charge_percent: parseFloat(outlet.service_charge_percent.toString()).toFixed(2),
    is_active: outlet.is_active,
    created_at: outlet.created_at,
  };
}

function mapOutletDetail(outlet: {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  tax_percent: { toString(): string };
  service_charge_percent: { toString(): string };
  is_active: boolean;
  created_at: Date;
}): OutletDetail {
  return {
    ...mapOutlet(outlet),
    organization_id: outlet.organization_id,
  };
}

/**
 * Lists outlets the user can access based on their staff assignments.
 * Owner (organization-wide assignment) sees all outlets in the organization.
 * Manager/Waiter/Kitchen see only outlets they're assigned to.
 */
export async function listOutlets(
  actor: StaffActor,
  filters: { page: number; limit: number; is_active?: boolean; search?: string },
): Promise<PaginatedOutlets> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  const where: Record<string, unknown> = {
    organization_id: actor.organization_id,
    deleted_at: null,
  };

  // If not organization-wide, filter by assigned outlets
  if (!organizationWide) {
    where.id = { in: outletIds };
    if (outletIds.length === 0) {
      return { outlets: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0 };
    }
  }

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  const [outlets, total] = await Promise.all([
    prisma.outlet.findMany({
      where,
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        timezone: true,
        tax_percent: true,
        service_charge_percent: true,
        is_active: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.outlet.count({ where }),
  ]);

  return {
    outlets: outlets.map(mapOutlet),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Gets a single outlet by ID.
 * Verifies the user has access to this outlet (assignment or organization-wide).
 */
export async function getOutlet(actor: StaffActor, outletId: string): Promise<OutletDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  // Check access before querying
  // Even organization-wide users can only access outlets in their own organization
  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
  }

  // First check if outlet exists in user's organization
  const outlet = await prisma.outlet.findFirst({
    where: {
      id: outletId,
      organization_id: actor.organization_id,
      deleted_at: null,
    },
    select: {
      id: true,
      organization_id: true,
      name: true,
      address: true,
      phone: true,
      timezone: true,
      tax_percent: true,
      service_charge_percent: true,
      is_active: true,
      created_at: true,
    },
  });

  if (!outlet) {
    // Check if outlet exists in another organization to distinguish 403 vs 404
    const outletInOtherOrg = await prisma.outlet.findFirst({
      where: { id: outletId, deleted_at: null },
      select: { organization_id: true },
    });

    if (outletInOtherOrg) {
      throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
    }

    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  return mapOutletDetail(outlet);
}

/**
 * Creates a new outlet for the organization.
 * Only Owner (organization-wide) can create outlets.
 * Plan limit check should be done before calling this.
 */
export async function createOutlet(
  actor: StaffActor,
  input: {
    name: string;
    address?: string;
    phone?: string;
    timezone?: string;
    tax_percent?: number;
    service_charge_percent?: number;
  },
): Promise<OutletDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide } = await getManageableOutletIds(actor);

  if (!organizationWide) {
    throw new AppError('FORBIDDEN', 'Only organization-wide staff can create outlets', 403);
  }

  const outlet = await prisma.outlet.create({
    data: {
      organization_id: actor.organization_id,
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      timezone: input.timezone ?? 'UTC',
      tax_percent: input.tax_percent ?? 13.0,
      service_charge_percent: input.service_charge_percent ?? 10.0,
    },
    select: {
      id: true,
      organization_id: true,
      name: true,
      address: true,
      phone: true,
      timezone: true,
      tax_percent: true,
      service_charge_percent: true,
      is_active: true,
      created_at: true,
    },
  });

  return mapOutletDetail(outlet);
}

/**
 * Updates an outlet's profile and settings.
 * Requires organization-wide access (Owner) or tables.manage permission at the outlet.
 */
export async function updateOutlet(
  actor: StaffActor,
  outletId: string,
  input: {
    name?: string;
    address?: string | null;
    phone?: string | null;
    timezone?: string;
    tax_percent?: number;
    service_charge_percent?: number;
    is_active?: boolean;
  },
): Promise<OutletDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
  }

  // Check if outlet exists in user's organization
  const existingOutlet = await prisma.outlet.findFirst({
    where: { id: outletId, organization_id: actor.organization_id },
    select: { id: true },
  });

  if (!existingOutlet) {
    // Check if outlet exists in another organization to distinguish 403 vs 404
    const outletInOtherOrg = await prisma.outlet.findFirst({
      where: { id: outletId },
      select: { organization_id: true },
    });

    if (outletInOtherOrg) {
      throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
    }

    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.address !== undefined) data.address = input.address;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.tax_percent !== undefined) data.tax_percent = input.tax_percent;
  if (input.service_charge_percent !== undefined)
    data.service_charge_percent = input.service_charge_percent;
  if (input.is_active !== undefined) data.is_active = input.is_active;

  const outlet = await prisma.outlet.update({
    where: { id: outletId, organization_id: actor.organization_id },
    data,
    select: {
      id: true,
      organization_id: true,
      name: true,
      address: true,
      phone: true,
      timezone: true,
      tax_percent: true,
      service_charge_percent: true,
      is_active: true,
      created_at: true,
    },
  });

  return mapOutletDetail(outlet);
}

/**
 * Deactivates an outlet (soft delete).
 * Only organization-wide staff (Owner) can deactivate.
 */
export async function deactivateOutlet(actor: StaffActor, outletId: string): Promise<OutletDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide } = await getManageableOutletIds(actor);

  if (!organizationWide) {
    throw new AppError('FORBIDDEN', 'Only organization-wide staff can deactivate outlets', 403);
  }

  // Check if outlet exists in user's organization
  const existingOutlet = await prisma.outlet.findFirst({
    where: { id: outletId, organization_id: actor.organization_id },
    select: { id: true },
  });

  if (!existingOutlet) {
    // Check if outlet exists in another organization to distinguish 403 vs 404
    const outletInOtherOrg = await prisma.outlet.findFirst({
      where: { id: outletId },
      select: { organization_id: true },
    });

    if (outletInOtherOrg) {
      throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
    }

    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  const updated = await prisma.outlet.update({
    where: { id: outletId, organization_id: actor.organization_id },
    data: { is_active: false },
    select: {
      id: true,
      organization_id: true,
      name: true,
      address: true,
      phone: true,
      timezone: true,
      tax_percent: true,
      service_charge_percent: true,
      is_active: true,
      created_at: true,
    },
  });

  return mapOutletDetail(updated);
}

/**
 * Sets the user's last active outlet.
 * Owner can set any outlet in their organization.
 * Manager can only set outlets they're assigned to.
 */
export async function setActiveOutlet(actor: StaffActor, outletId: string): Promise<OutletDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
  }

  // Check if outlet exists in user's organization
  const existingOutlet = await prisma.outlet.findFirst({
    where: { id: outletId, organization_id: actor.organization_id },
    select: { id: true },
  });

  if (!existingOutlet) {
    const outletInOtherOrg = await prisma.outlet.findFirst({
      where: { id: outletId },
      select: { organization_id: true },
    });

    if (outletInOtherOrg) {
      throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
    }

    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  // Update user's last_outlet_id
  await prisma.user.update({
    where: { id: actor.id },
    data: { last_outlet_id: outletId },
  });

  // Return the outlet details
  const outlet = await prisma.outlet.findUniqueOrThrow({
    where: { id: outletId },
    select: {
      id: true,
      organization_id: true,
      name: true,
      address: true,
      phone: true,
      timezone: true,
      tax_percent: true,
      service_charge_percent: true,
      is_active: true,
      created_at: true,
    },
  });

  return mapOutletDetail(outlet);
}
