import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor } from '@/services/staff/access';

export interface ConsolidatedSummary {
  period: { from: Date; to: Date };
  outlets: number;
  revenue: {
    total: string;
    by_outlet: Array<{ outlet_id: string; outlet_name: string; revenue: string; orders: number }>;
  };
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    average_order_value: string;
    by_outlet: Array<{ outlet_id: string; outlet_name: string; total: number; completed: number; aov: string }>;
  };
  items: {
    total_sold: number;
    top_items_overall: Array<{ menu_item_id: string; name: string; quantity_sold: number; revenue: string }>;
    top_items_by_outlet: Array<{
      outlet_id: string;
      outlet_name: string;
      items: Array<{ menu_item_id: string; name: string; quantity_sold: number; revenue: string }>;
    }>;
  };
  payments: {
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    by_method: { cash: string; online: string; card: string };
    by_outlet: Array<{ outlet_id: string; outlet_name: string; total: string; succeeded: string }>;
  };
  inventory: {
    total_ingredients: number;
    low_stock_outlets: number;
    wastage_cost: string;
    wastage_count: number;
    by_outlet: Array<{ outlet_id: string; outlet_name: string; low_stock: number; wastage_cost: string }>;
  };
}

/**
 * Gets consolidated analytics across all outlets for an organization owner.
 */
export async function getConsolidatedAnalytics(
  actor: StaffActor,
  filters: {
    date_from?: Date;
    date_to?: Date;
  } = {},
): Promise<ConsolidatedSummary> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Only owners (organization-wide) can access consolidated analytics
  if (!actor.is_super_admin) {
    const hasOwnerAssignment = await prisma.staffAssignment.findFirst({
      where: {
        user_id: actor.id,
        outlet_id: null,
        role: { code: 'owner' },
      },
      select: { id: true },
    });

    if (!hasOwnerAssignment) {
      throw new AppError('FORBIDDEN', 'Consolidated analytics require Owner role', 403);
    }
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  if (!organizationWide && outletIds.length === 0) {
    return getEmptyConsolidatedSummary(filters);
  }

  const dateFrom = filters.date_from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = filters.date_to ?? new Date();

  // Get all outlets in organization
  const outlets = await prisma.outlet.findMany({
    where: organizationWide
      ? { organization_id: actor.organization_id, deleted_at: null }
      : { id: { in: outletIds } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const targetOutletIds = outlets.map((o) => o.id);
  const outletMap = new Map(outlets.map((o) => [o.id, o.name]));

  const baseWhere = organizationWide
    ? { outlet: { organization_id: actor.organization_id } }
    : { outlet_id: { in: targetOutletIds } };

  const dateRangeWhere = {
    created_at: { gte: dateFrom, lte: dateTo },
  };

  // 1. Revenue by outlet
  const paidBills = await prisma.bill.findMany({
    where: { ...baseWhere, status: 'paid', paid_at: { gte: dateFrom, lte: dateTo } },
    select: { outlet_id: true, total: true, paid_at: true },
  });

  const revenueByOutlet = new Map<string, { revenue: number; orders: number }>();
  for (const bill of paidBills) {
    const existing = revenueByOutlet.get(bill.outlet_id) || { revenue: 0, orders: 0 };
    existing.revenue += Number(bill.total);
    existing.orders += 1;
    revenueByOutlet.set(bill.outlet_id, existing);
  }

  // 2. Orders by outlet
  const allOrders = await prisma.order.findMany({
    where: { ...baseWhere, ...dateRangeWhere },
    select: { outlet_id: true, status: true, total: true },
  });

  const ordersByOutlet = new Map<string, { total: number; completed: number; revenue: number }>();
  for (const order of allOrders) {
    const existing = ordersByOutlet.get(order.outlet_id) || { total: 0, completed: 0, revenue: 0 };
    existing.total += 1;
    existing.revenue += Number(order.total);
    if (order.status === 'completed') existing.completed += 1;
    ordersByOutlet.set(order.outlet_id, existing);
  }

  // 3. Items sold by outlet
  const orderItems = await prisma.orderItem.findMany({
    where: { order: { ...baseWhere, ...dateRangeWhere, status: { notIn: ['cancelled'] } } },
    select: { order: { select: { outlet_id: true } }, menu_item_id: true, item_name: true, quantity: true, line_total: true },
  });

  interface ItemStat { menu_item_id: string; name: string; quantity_sold: number; revenue: number; }
  const itemsByOutlet = new Map<string, Map<string, ItemStat>>();
  const overallItems = new Map<string, ItemStat>();

  for (const item of orderItems) {
    const outletId = item.order.outlet_id;
    const qty = item.quantity;
    const revenue = Number(item.line_total);

    // Per outlet
    const outletItems = itemsByOutlet.get(outletId) || new Map<string, ItemStat>();
    const existingOutletItem = outletItems.get(item.menu_item_id);
    if (existingOutletItem) {
      existingOutletItem.quantity_sold += qty;
      existingOutletItem.revenue += revenue;
    } else {
      outletItems.set(item.menu_item_id, { menu_item_id: item.menu_item_id, name: item.item_name, quantity_sold: qty, revenue });
    }
    itemsByOutlet.set(outletId, outletItems);

    // Overall
    const existingOverall = overallItems.get(item.menu_item_id);
    if (existingOverall) {
      existingOverall.quantity_sold += qty;
      existingOverall.revenue += revenue;
    } else {
      overallItems.set(item.menu_item_id, { menu_item_id: item.menu_item_id, name: item.item_name, quantity_sold: qty, revenue });
    }
  }

  // 4. Payments
  const allPayments = await prisma.payment.findMany({
    where: { ...baseWhere, ...dateRangeWhere },
    select: { outlet_id: true, status: true, method: true, amount: true },
  });

  const paymentsByOutlet = new Map<string, { total: number; succeeded: number; amount: number }>();
  const paymentMethods = { cash: 0, online: 0, card: 0 };
  for (const p of allPayments) {
    paymentMethods[p.method] += Number(p.amount);
    const existing = paymentsByOutlet.get(p.outlet_id) || { total: 0, succeeded: 0, amount: 0 };
    existing.total += 1;
    existing.amount += Number(p.amount);
    if (p.status === 'succeeded') existing.succeeded += 1;
    paymentsByOutlet.set(p.outlet_id, existing);
  }

  // 5. Inventory
  const stockItems = await prisma.outletStock.findMany({
    where: { outlet_id: { in: targetOutletIds } },
    select: { outlet_id: true, low_threshold: true, quantity: true },
  });

  const wastageMovements = await prisma.stockMovement.findMany({
    where: { outlet_id: { in: targetOutletIds }, type: 'wastage', created_at: { gte: dateFrom, lte: dateTo } },
    select: { outlet_id: true, quantity_delta: true, unit_cost: true },
  });

  const wastageByOutlet = new Map<string, { cost: number; count: number }>();
  for (const m of wastageMovements) {
    const unitCost = m.unit_cost ? Number(m.unit_cost) : null;
    const cost = unitCost !== null ? Math.abs(Number(m.quantity_delta)) * unitCost : 0;
    const existing = wastageByOutlet.get(m.outlet_id) || { cost: 0, count: 0 };
    existing.cost += cost;
    existing.count += 1;
    wastageByOutlet.set(m.outlet_id, existing);
  }

  const lowStockByOutlet = new Map<string, number>();
  for (const stock of stockItems) {
    const qty = Number(stock.quantity);
    const threshold = Number(stock.low_threshold ?? 0);
    if (threshold > 0 && qty <= threshold) {
      lowStockByOutlet.set(stock.outlet_id, (lowStockByOutlet.get(stock.outlet_id) || 0) + 1);
    }
  }

  // Build response
  const revenueByOutletArr = Array.from(revenueByOutlet.entries()).map(([outlet_id, data]) => ({
    outlet_id,
    outlet_name: outletMap.get(outlet_id) || 'Unknown',
    revenue: data.revenue.toFixed(2),
    orders: data.orders,
  }));

  const ordersByOutletArr = Array.from(ordersByOutlet.entries()).map(([outlet_id, data]) => ({
    outlet_id,
    outlet_name: outletMap.get(outlet_id) || 'Unknown',
    total: data.total,
    completed: data.completed,
    aov: data.total > 0 ? (data.revenue / data.total).toFixed(2) : '0.00',
  }));

  const topItemsOverall = Array.from(overallItems.values())
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, 10)
    .map((item) => ({ menu_item_id: item.menu_item_id, name: item.name, quantity_sold: item.quantity_sold, revenue: item.revenue.toFixed(2) }));

  const topItemsByOutlet = Array.from(itemsByOutlet.entries()).map(([outlet_id, itemsMap]) => ({
    outlet_id,
    outlet_name: outletMap.get(outlet_id) || 'Unknown',
    items: Array.from(itemsMap.values())
      .sort((a, b) => b.quantity_sold - a.quantity_sold)
      .slice(0, 5)
      .map((item) => ({ menu_item_id: item.menu_item_id, name: item.name, quantity_sold: item.quantity_sold, revenue: item.revenue.toFixed(2) })),
  }));

  const paymentsByOutletArr = Array.from(paymentsByOutlet.entries()).map(([outlet_id, data]) => ({
    outlet_id,
    outlet_name: outletMap.get(outlet_id) || 'Unknown',
    total: data.amount.toFixed(2),
    succeeded: data.succeeded.toFixed(2),
  }));

  const inventoryByOutlet = Array.from(targetOutletIds).map((outlet_id) => ({
    outlet_id,
    outlet_name: outletMap.get(outlet_id) || 'Unknown',
    low_stock: lowStockByOutlet.get(outlet_id) || 0,
    wastage_cost: wastageByOutlet.get(outlet_id)?.cost.toFixed(2) || '0.00',
  }));

  // Totals
  const totalRevenue = revenueByOutletArr.reduce((sum, o) => sum + Number(o.revenue), 0).toFixed(2);
  const totalOrders = allOrders.length;
  const totalCompleted = allOrders.filter((o) => o.status === 'completed').length;
  const totalCancelled = allOrders.filter((o) => o.status === 'cancelled').length;
  const totalRevenueValue = allOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalPayments = allPayments.length;
  const totalSucceeded = allPayments.filter((p) => p.status === 'succeeded').length;
  const totalFailed = allPayments.filter((p) => p.status === 'failed').length;
  const totalPending = allPayments.filter((p) => p.status === 'pending').length;
  const totalItemsSold = orderItems.reduce((sum, i) => sum + i.quantity, 0);

  return {
    period: { from: dateFrom, to: dateTo },
    outlets: outlets.length,
    revenue: {
      total: totalRevenue,
      by_outlet: revenueByOutletArr,
    },
    orders: {
      total: totalOrders,
      completed: totalCompleted,
      cancelled: totalCancelled,
      average_order_value: totalOrders > 0 ? (totalRevenueValue / totalOrders).toFixed(2) : '0.00',
      by_outlet: ordersByOutletArr,
    },
    items: {
      total_sold: totalItemsSold,
      top_items_overall: topItemsOverall,
      top_items_by_outlet: topItemsByOutlet,
    },
    payments: {
      total: totalPayments,
      succeeded: totalSucceeded,
      failed: totalFailed,
      pending: totalPending,
      by_method: {
        cash: paymentMethods.cash.toFixed(2),
        online: paymentMethods.online.toFixed(2),
        card: paymentMethods.card.toFixed(2),
      },
      by_outlet: paymentsByOutletArr,
    },
    inventory: {
      total_ingredients: stockItems.length,
      low_stock_outlets: Array.from(lowStockByOutlet.values()).filter((v) => v > 0).length,
      wastage_cost: wastageMovements
        .map((m) => (m.unit_cost ? Math.abs(Number(m.quantity_delta)) * Number(m.unit_cost) : 0))
        .reduce((sum, c) => sum + c, 0)
        .toFixed(2),
      wastage_count: wastageMovements.length,
      by_outlet: inventoryByOutlet,
    },
  };
}

function getEmptyConsolidatedSummary(filters: { date_from?: Date; date_to?: Date }): ConsolidatedSummary {
  return {
    period: { from: filters.date_from ?? new Date(), to: filters.date_to ?? new Date() },
    outlets: 0,
    revenue: { total: '0.00', by_outlet: [] },
    orders: { total: 0, completed: 0, cancelled: 0, average_order_value: '0.00', by_outlet: [] },
    items: { total_sold: 0, top_items_overall: [], top_items_by_outlet: [] },
    payments: { total: 0, succeeded: 0, failed: 0, pending: 0, by_method: { cash: '0.00', online: '0.00', card: '0.00' }, by_outlet: [] },
    inventory: { total_ingredients: 0, low_stock_outlets: 0, wastage_cost: '0.00', wastage_count: 0, by_outlet: [] },
  };
}