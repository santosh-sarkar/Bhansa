import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor } from '@/services/staff/access';

export interface StockReportItem {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  current_stock: string;
  low_threshold: string;
  is_low: boolean;
}

export interface WastageReportItem {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  quantity: string;
  unit_cost: string | null;
  cost: string | null;
  reason: string | null;
  created_at: Date;
  performed_by: string | null;
}

export interface UsageReportItem {
  type: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  total_quantity: string;
  count: number;
}

export interface InventoryReportSummary {
  total_ingredients: number;
  low_stock_count: number;
  total_stock_value: string;
  total_wastage_cost: string;
  wastage_count: number;
  period: {
    from: Date;
    to: Date;
  };
}

export interface InventoryReport {
  summary: InventoryReportSummary;
  stock: StockReportItem[];
  wastage: WastageReportItem[];
  usage: UsageReportItem[];
}

/**
 * Generates a comprehensive inventory report for an outlet.
 */
export async function generateInventoryReport(
  actor: StaffActor,
  outletId: string,
  filters: {
    date_from?: Date;
    date_to?: Date;
  } = {},
): Promise<InventoryReport> {
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

  const dateFrom = filters.date_from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = filters.date_to ?? new Date();

  // 1. Get current stock report
  const stockItems = await prisma.outletStock.findMany({
    where: {
      outlet_id: outletId,
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
    orderBy: { ingredient: { name: 'asc' } },
  });

  const stock: StockReportItem[] = stockItems.map((item) => {
    const quantity = Number(item.quantity);
    const threshold = Number(item.low_threshold ?? 0);

    return {
      ingredient_id: item.ingredient.id,
      ingredient_name: item.ingredient.name,
      ingredient_unit: item.ingredient.unit,
      current_stock: Number(item.quantity).toFixed(3),
      low_threshold: Number(item.low_threshold ?? 0).toFixed(3),
      is_low: threshold > 0 && quantity <= threshold,
    };
  });

  // 2. Get wastage report
  const wastageMovements = await prisma.stockMovement.findMany({
    where: {
      outlet_id: outletId,
      type: 'wastage',
      created_at: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
      performedByUser: {
        select: { full_name: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const wastage: WastageReportItem[] = wastageMovements.map((m) => {
    const quantity = Math.abs(Number(m.quantity_delta));
    const unitCost = m.unit_cost ? Number(m.unit_cost) : null;
    const cost = unitCost !== null ? (quantity * unitCost).toFixed(2) : null;

    return {
      id: m.id,
      ingredient_id: m.ingredient.id,
      ingredient_name: m.ingredient.name,
      ingredient_unit: m.ingredient.unit,
      quantity: quantity.toFixed(3),
      unit_cost: unitCost?.toFixed(2) ?? null,
      cost,
      reason: m.reason,
      created_at: m.created_at,
      performed_by: m.performedByUser?.full_name ?? null,
    };
  });

  // 3. Get usage report (all movement types)
  const allMovements = await prisma.stockMovement.findMany({
    where: {
      outlet_id: outletId,
      created_at: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    include: {
      ingredient: {
        select: { id: true, name: true, unit: true },
      },
    },
  });

  // Aggregate by type and ingredient
  const usageMap = new Map<string, UsageReportItem>();

  for (const m of allMovements) {
    const key = `${m.type}-${m.ingredient_id}`;
    const quantity = Math.abs(Number(m.quantity_delta));

    const existing = usageMap.get(key);
    if (existing) {
      existing.total_quantity = (Number(existing.total_quantity) + quantity).toFixed(3);
      existing.count += 1;
    } else {
      usageMap.set(key, {
        type: m.type,
        ingredient_id: m.ingredient.id,
        ingredient_name: m.ingredient.name,
        ingredient_unit: m.ingredient.unit,
        total_quantity: quantity.toFixed(3),
        count: 1,
      });
    }
  }

  const usage = Array.from(usageMap.values()).sort((a, b) => Number(b.total_quantity) - Number(a.total_quantity));

  // Calculate summary
  const totalIngredients = stock.length;
  const lowStockCount = stock.filter((s) => s.is_low).length;
  const totalStockValue = '0.00';

  const wastageItems = wastageMovements.map((m) => {
    const unitCost = m.unit_cost ? Number(m.unit_cost) : null;
    const quantity = Math.abs(Number(m.quantity_delta));
    return unitCost !== null ? quantity * unitCost : 0;
  });
  const totalWastageCost = wastageItems.reduce((sum, c) => sum + c, 0).toFixed(2);

  const summary: InventoryReportSummary = {
    total_ingredients: totalIngredients,
    low_stock_count: lowStockCount,
    total_stock_value: totalStockValue,
    total_wastage_cost: totalWastageCost,
    wastage_count: wastage.length,
    period: { from: dateFrom, to: dateTo },
  };

  return {
    summary,
    stock,
    wastage,
    usage,
  };
}

/**
 * Gets consolidated inventory report across all accessible outlets.
 */
export async function generateConsolidatedInventoryReport(
  actor: StaffActor,
  filters: {
    date_from?: Date;
    date_to?: Date;
  } = {},
): Promise<{
  summary: {
    total_outlets: number;
    total_ingredients: number;
    total_stock_value: string;
    total_wastage_cost: string;
    wastage_count: number;
    period: { from: Date; to: Date };
  };
  outlets: Array<{
    outlet_id: string;
    outlet_name: string;
    total_ingredients: number;
    low_stock_count: number;
    stock_value: string;
    wastage_cost: string;
    wastage_count: number;
  }>;
}> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    return {
      summary: {
        total_outlets: 0,
        total_ingredients: 0,
        total_stock_value: '0.00',
        total_wastage_cost: '0.00',
        wastage_count: 0,
        period: { from: new Date(), to: new Date() },
      },
      outlets: [],
    };
  }

  const targetOutletIds = organizationWide
    ? (await prisma.outlet.findMany({
        where: { organization_id: actor.organization_id, deleted_at: null },
        select: { id: true },
      })).map((o) => o.id)
    : outletIds;

  const dateFrom = filters.date_from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = filters.date_to ?? new Date();

  // Get all outlets info
  const outletsInfo = await prisma.outlet.findMany({
    where: { id: { in: targetOutletIds } },
    select: { id: true, name: true },
  });

  const outletReports = await Promise.all(
    outletsInfo.map(async (outlet) => {
      // Get stock
      const stockItems = await prisma.outletStock.findMany({
        where: { outlet_id: outlet.id },
        include: { ingredient: { select: { id: true, name: true, unit: true } } },
      });

      const lowStockCount = stockItems.filter((item) => {
        const qty = Number(item.quantity);
        const threshold = Number(item.low_threshold ?? 0);
        return threshold > 0 && qty <= threshold;
      }).length;

      // Get wastage
      const wastageMovements = await prisma.stockMovement.findMany({
        where: {
          outlet_id: outlet.id,
          type: 'wastage',
          created_at: { gte: dateFrom, lte: dateTo },
        },
        select: { quantity_delta: true, unit_cost: true },
      });

      const wastageCost = wastageMovements.reduce((sum, m) => {
        const unitCost = m.unit_cost ? Number(m.unit_cost) : null;
        if (unitCost !== null) {
          return sum + Math.abs(Number(m.quantity_delta)) * unitCost;
        }
        return sum;
      }, 0);

      return {
        outlet_id: outlet.id,
        outlet_name: outlet.name,
        total_ingredients: stockItems.length,
        low_stock_count: lowStockCount,
        stock_value: '0.00',
        wastage_cost: wastageCost.toFixed(2),
        wastage_count: wastageMovements.length,
      };
    }),
  );

  const totalIngredients = outletReports.reduce((sum, o) => sum + o.total_ingredients, 0);
  const totalWastageCost = outletReports.reduce((sum, o) => sum + Number(o.wastage_cost), 0).toFixed(2);
  const totalWastageCount = outletReports.reduce((sum, o) => sum + o.wastage_count, 0);

  return {
    summary: {
      total_outlets: outletsInfo.length,
      total_ingredients: totalIngredients,
      total_stock_value: '0.00',
      total_wastage_cost: totalWastageCost,
      wastage_count: totalWastageCount,
      period: { from: dateFrom, to: dateTo },
    },
    outlets: outletReports,
  };
}