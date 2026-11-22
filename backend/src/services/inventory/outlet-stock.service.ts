import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import {
  getAccessibleOutletIds,
  getManageableOutletIds,
  type StaffActor,
} from '@/services/staff/access';
import type { Prisma } from '@prisma/client';

export interface OutletStockListItem {
  outlet_id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  quantity: Prisma.Decimal;
  low_threshold: Prisma.Decimal;
  is_low: boolean;
  updated_at: Date;
}

export interface OutletStockDetail extends OutletStockListItem {
  movements?: Array<{
    id: string;
    type: string;
    quantity_delta: Prisma.Decimal;
    balance_after: Prisma.Decimal;
    unit_cost: Prisma.Decimal | null;
    supplier: string | null;
    reason: string | null;
    order_id: string | null;
    performed_by: string | null;
    created_at: Date;
  }>;
}

export interface PaginatedOutletStock {
  items: OutletStockListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Lists outlet stock for a specific outlet.
 */
export async function listOutletStock(
  actor: StaffActor,
  outletId: string,
  filters: { page: number; limit: number; is_low?: boolean; search?: string },
): Promise<PaginatedOutletStock> {
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

  if (filters.search) {
    where.ingredient = { name: { contains: filters.search, mode: 'insensitive' } };
  }

  // Fetch all items first, then apply is_low filter in memory
  // This is because Prisma doesn't support field-to-field comparisons in where clauses
  const [allItems] = await Promise.all([
    prisma.outletStock.findMany({
      where,
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true },
        },
      },
      orderBy: { ingredient: { name: 'asc' } },
    }),
  ]);

  // Apply is_low filter in memory
  let filteredItems = allItems;
  if (filters.is_low !== undefined) {
    if (filters.is_low) {
      filteredItems = allItems.filter(
        (item) =>
          Number(item.quantity) <= Number(item.low_threshold) && Number(item.low_threshold) > 0,
      );
    } else {
      filteredItems = allItems.filter(
        (item) =>
          Number(item.low_threshold) === 0 || Number(item.quantity) > Number(item.low_threshold),
      );
    }
  }

  // Apply pagination
  const items = filteredItems.slice(
    (filters.page - 1) * filters.limit,
    filters.page * filters.limit,
  );

  return {
    items: items.map((item) => ({
      outlet_id: item.outlet_id,
      ingredient_id: item.ingredient_id,
      ingredient_name: item.ingredient.name,
      ingredient_unit: item.ingredient.unit,
      quantity: item.quantity,
      low_threshold: item.low_threshold,
      is_low: Number(item.quantity) <= Number(item.low_threshold) && Number(item.low_threshold) > 0,
      updated_at: item.updated_at,
    })),
    total: filteredItems.length,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(filteredItems.length / filters.limit),
  };
}

/**
 * Gets outlet stock detail for a specific ingredient.
 */
export async function getOutletStock(
  actor: StaffActor,
  outletId: string,
  ingredientId: string,
): Promise<OutletStockDetail> {
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

  const stock = await prisma.outletStock.findUnique({
    where: {
      outlet_id_ingredient_id: {
        outlet_id: outletId,
        ingredient_id: ingredientId,
      },
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
  });

  if (!stock) {
    throw new AppError(
      'NOT_FOUND',
      'Stock record not found for this ingredient at this outlet',
      404,
    );
  }

  // Get recent movements
  const movements = await prisma.stockMovement.findMany({
    where: {
      outlet_id: outletId,
      ingredient_id: ingredientId,
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  });

  return {
    outlet_id: stock.outlet_id,
    ingredient_id: stock.ingredient_id,
    ingredient_name: stock.ingredient.name,
    ingredient_unit: stock.ingredient.unit,
    quantity: stock.quantity,
    low_threshold: stock.low_threshold,
    is_low:
      Number(stock.quantity) <= Number(stock.low_threshold) && Number(stock.low_threshold) > 0,
    updated_at: stock.updated_at,
    movements: movements.map((m) => ({
      id: m.id,
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
  };
}

/**
 * Updates the low threshold for an ingredient at an outlet.
 */
export async function updateLowThreshold(
  actor: StaffActor,
  outletId: string,
  ingredientId: string,
  lowThreshold: string,
): Promise<OutletStockDetail> {
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

  // Check outlet access - only Owner and Manager with inventory.manage can update thresholds
  const { organizationWide, outletIds } = await getManageableOutletIds(actor);
  if (!organizationWide && !outletIds.includes(outletId)) {
    throw new AppError('FORBIDDEN', `No access to outlet ${outletId}`, 403);
  }

  // Verify ingredient exists in organization
  const ingredient = await prisma.ingredient.findFirst({
    where: {
      id: ingredientId,
      organization_id: actor.organization_id,
    },
    select: { id: true },
  });

  if (!ingredient) {
    throw new AppError('NOT_FOUND', 'Ingredient not found', 404);
  }

  // Upsert stock record with new threshold
  const stock = await prisma.outletStock.upsert({
    where: {
      outlet_id_ingredient_id: {
        outlet_id: outletId,
        ingredient_id: ingredientId,
      },
    },
    update: {
      low_threshold: lowThreshold,
    },
    create: {
      outlet_id: outletId,
      ingredient_id: ingredientId,
      quantity: 0,
      low_threshold: lowThreshold,
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
  });

  return {
    outlet_id: stock.outlet_id,
    ingredient_id: stock.ingredient_id,
    ingredient_name: stock.ingredient.name,
    ingredient_unit: stock.ingredient.unit,
    quantity: stock.quantity,
    low_threshold: stock.low_threshold,
    is_low:
      Number(stock.quantity) <= Number(stock.low_threshold) && Number(stock.low_threshold) > 0,
    updated_at: stock.updated_at,
  };
}

/**
 * Bulk updates low thresholds for multiple ingredients at an outlet.
 */
export async function bulkUpdateLowThreshold(
  actor: StaffActor,
  outletId: string,
  items: Array<{ ingredient_id: string; low_threshold: string }>,
): Promise<OutletStockDetail[]> {
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

  // Verify all ingredients exist in organization
  const ingredientIds = items.map((i) => i.ingredient_id);
  const ingredients = await prisma.ingredient.findMany({
    where: {
      id: { in: ingredientIds },
      organization_id: actor.organization_id,
    },
    select: { id: true },
  });

  if (ingredients.length !== ingredientIds.length) {
    const foundIds = new Set(ingredients.map((i) => i.id));
    const missingIds = ingredientIds.filter((id) => !foundIds.has(id));
    throw new AppError('NOT_FOUND', `Ingredients not found: ${missingIds.join(', ')}`, 404);
  }

  // Bulk upsert in transaction
  const result = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const item of items) {
      const stock = await tx.outletStock.upsert({
        where: {
          outlet_id_ingredient_id: {
            outlet_id: outletId,
            ingredient_id: item.ingredient_id,
          },
        },
        update: {
          low_threshold: item.low_threshold,
        },
        create: {
          outlet_id: outletId,
          ingredient_id: item.ingredient_id,
          quantity: 0,
          low_threshold: item.low_threshold,
        },
        include: {
          ingredient: {
            select: { id: true, name: true, unit: true },
          },
        },
      });
      results.push({
        outlet_id: stock.outlet_id,
        ingredient_id: stock.ingredient_id,
        ingredient_name: stock.ingredient.name,
        ingredient_unit: stock.ingredient.unit,
        quantity: stock.quantity,
        low_threshold: stock.low_threshold,
        is_low:
          Number(stock.quantity) <= Number(stock.low_threshold) && Number(stock.low_threshold) > 0,
        updated_at: stock.updated_at,
      });
    }
    return results;
  });

  return result;
}
