import type { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor } from '@/services/staff/access';

export interface StockMovementListItem {
  id: string;
  outlet_id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  type: string;
  quantity_delta: Prisma.Decimal;
  balance_after: Prisma.Decimal;
  unit_cost: Prisma.Decimal | null;
  supplier: string | null;
  reason: string | null;
  order_id: string | null;
  performed_by: string | null;
  created_at: Date;
}

export interface PaginatedStockMovements {
  movements: StockMovementListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Lists stock movements for an outlet with optional filters.
 */
export async function listStockMovements(
  actor: StaffActor,
  outletId: string,
  filters: {
    page: number;
    limit: number;
    ingredient_id?: string;
    type?: string;
    start_date?: string;
    end_date?: string;
  },
): Promise<PaginatedStockMovements> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Verify outlet exists and user has access
  const outlet = await prisma.outlet.findFirst({
    where: {
      id: outletId,
      organization_id: actor.organization_id,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!outlet) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  // Check outlet access
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', `No access to outlet ${outletId}`, 403);
  }

  const where: Record<string, unknown> = {
    outlet_id: outletId,
  };

  if (filters.ingredient_id) {
    where.ingredient_id = filters.ingredient_id;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.start_date || filters.end_date) {
    where.created_at = {};
    if (filters.start_date) {
      (where.created_at as Record<string, unknown>).gte = new Date(filters.start_date);
    }
    if (filters.end_date) {
      (where.created_at as Record<string, unknown>).lte = new Date(filters.end_date);
    }
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    movements: movements.map((m) => ({
      id: m.id,
      outlet_id: m.outlet_id,
      ingredient_id: m.ingredient_id,
      ingredient_name: m.ingredient.name,
      ingredient_unit: m.ingredient.unit,
      type: m.type,
      quantity_delta: m.quantity_delta,
      balance_after: m.balance_after,
      unit_cost: m.unit_cost,
      supplier: m.supplier,
      reason: m.reason,
      order_id: m.order_id,
      performed_by: m.performed_by,
      created_at: m.created_at,
    })),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}
