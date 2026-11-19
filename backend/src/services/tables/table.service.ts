import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import {
  getAccessibleOutletIds,
  getManageableOutletIds,
  type StaffActor,
} from '@/services/staff/access';

export interface TableListItem {
  id: string;
  outlet_id: string;
  label: string;
  seats: number | null;
  qr_token: string;
  status: string;
  is_active: boolean;
}

export interface TableDetail extends TableListItem {
  outlet_id: string;
}

export interface PaginatedTables {
  tables: TableListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Generates a secure random QR token.
 */
function generateQrToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Lists tables for an outlet.
 */
export async function listTables(
  actor: StaffActor,
  outletId: string,
  filters: { page: number; limit: number; is_active?: boolean; status?: string; search?: string },
): Promise<PaginatedTables> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  // Check if outlet belongs to user's organization
  const outlet = await prisma.outlet.findFirst({
    where: { id: outletId, organization_id: actor.organization_id, deleted_at: null },
    select: { id: true },
  });

  if (!outlet) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
  }

  const where: Record<string, unknown> = {
    outlet_id: outletId,
  };

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    where.label = { contains: filters.search, mode: 'insensitive' };
  }

  const [tables, total] = await Promise.all([
    prisma.diningTable.findMany({
      where,
      select: {
        id: true,
        outlet_id: true,
        label: true,
        seats: true,
        qr_token: true,
        status: true,
        is_active: true,
      },
      orderBy: { label: 'asc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.diningTable.count({ where }),
  ]);

  return {
    tables,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Gets a single table by ID.
 */
export async function getTable(
  actor: StaffActor,
  outletId: string,
  tableId: string,
): Promise<TableDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  // Check if outlet belongs to user's organization
  const outlet = await prisma.outlet.findFirst({
    where: { id: outletId, organization_id: actor.organization_id, deleted_at: null },
    select: { id: true },
  });

  if (!outlet) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
  }

  const table = await prisma.diningTable.findFirst({
    where: {
      id: tableId,
      outlet_id: outletId,
    },
    select: {
      id: true,
      outlet_id: true,
      label: true,
      seats: true,
      qr_token: true,
      status: true,
      is_active: true,
    },
  });

  if (!table) {
    throw new AppError('NOT_FOUND', 'Table not found', 404);
  }

  return table;
}

/**
 * Creates a new table for an outlet.
 * Requires tables.manage permission.
 */
export async function createTable(
  actor: StaffActor,
  outletId: string,
  input: { label: string; seats?: number },
): Promise<TableDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
  }

  // Check if label already exists in this outlet
  const existing = await prisma.diningTable.findFirst({
    where: { outlet_id: outletId, label: input.label },
  });

  if (existing) {
    throw new AppError('CONFLICT', 'Table label already exists in this outlet', 409);
  }

  const table = await prisma.diningTable.create({
    data: {
      outlet_id: outletId,
      label: input.label,
      seats: input.seats ?? null,
      qr_token: generateQrToken(),
      status: 'free',
      is_active: true,
    },
    select: {
      id: true,
      outlet_id: true,
      label: true,
      seats: true,
      qr_token: true,
      status: true,
      is_active: true,
    },
  });

  return table;
}

/**
 * Updates a table.
 */
export async function updateTable(
  actor: StaffActor,
  outletId: string,
  tableId: string,
  input: { label?: string; seats?: number | null; is_active?: boolean },
): Promise<TableDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
  }

  // Check if table exists in this outlet
  const existing = await prisma.diningTable.findFirst({
    where: { id: tableId, outlet_id: outletId },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Table not found', 404);
  }

  // Check label uniqueness if changing
  if (input.label !== undefined && input.label !== existing.label) {
    const duplicate = await prisma.diningTable.findFirst({
      where: { outlet_id: outletId, label: input.label, id: { not: tableId } },
    });

    if (duplicate) {
      throw new AppError('CONFLICT', 'Table label already exists in this outlet', 409);
    }
  }

  const data: Record<string, unknown> = {};

  if (input.label !== undefined) data.label = input.label;
  if (input.seats !== undefined) data.seats = input.seats;
  if (input.is_active !== undefined) data.is_active = input.is_active;

  const table = await prisma.diningTable.update({
    where: { id: tableId },
    data,
    select: {
      id: true,
      outlet_id: true,
      label: true,
      seats: true,
      qr_token: true,
      status: true,
      is_active: true,
    },
  });

  return table;
}

/**
 * Deactivates a table (soft delete).
 */
export async function deactivateTable(
  actor: StaffActor,
  outletId: string,
  tableId: string,
): Promise<TableDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
  }

  const existing = await prisma.diningTable.findFirst({
    where: { id: tableId, outlet_id: outletId },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Table not found', 404);
  }

  const table = await prisma.diningTable.update({
    where: { id: tableId },
    data: { is_active: false },
    select: {
      id: true,
      outlet_id: true,
      label: true,
      seats: true,
      qr_token: true,
      status: true,
      is_active: true,
    },
  });

  return table;
}

/**
 * Regenerates the QR token for a table.
 */
export async function regenerateQrToken(
  actor: StaffActor,
  outletId: string,
  tableId: string,
): Promise<TableDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', 'Outlet access denied', 403);
  }

  const existing = await prisma.diningTable.findFirst({
    where: { id: tableId, outlet_id: outletId },
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Table not found', 404);
  }

  const table = await prisma.diningTable.update({
    where: { id: tableId },
    data: { qr_token: generateQrToken() },
    select: {
      id: true,
      outlet_id: true,
      label: true,
      seats: true,
      qr_token: true,
      status: true,
      is_active: true,
    },
  });

  return table;
}
