import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor } from '@/services/staff/access';

export interface AnalyticsSummary {
  period: {
    from: Date;
    to: Date;
  };
  revenue: {
    total: string;
    cash: string;
    online: string;
    card: string;
  };
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    average_order_value: string;
  };
  items: {
    total_sold: number;
    top_items: Array<{
      menu_item_id: string;
      name: string;
      quantity_sold: number;
      revenue: string;
    }>;
  };
  payments: {
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
  };
}

export interface RevenueByDay {
  date: string;
  revenue: string;
  orders: number;
  average_order_value: string;
}

/**
 * Gets summary analytics for the current user's accessible outlets.
 */
export async function getAnalyticsSummary(
  actor: StaffActor,
  filters: {
    date_from?: Date;
    date_to?: Date;
    outlet_id?: string;
  } = {},
): Promise<AnalyticsSummary> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  // Determine outlet filter
  let targetOutletIds = outletIds;
  if (filters.outlet_id) {
    if (!organizationWide && !outletIds.includes(filters.outlet_id)) {
      throw new AppError('FORBIDDEN', 'No access to this outlet', 403);
    }
    targetOutletIds = [filters.outlet_id];
  }

  if (!organizationWide && targetOutletIds.length === 0) {
    return getEmptySummary(filters);
  }

  const dateFrom = filters.date_from ?? new Date(new Date().setHours(0, 0, 0, 0));
  const dateTo = filters.date_to ?? new Date();

  // Base where clause for bills/orders/payments
  const baseWhere = organizationWide
    ? { outlet: { organization_id: actor.organization_id } }
    : { outlet_id: { in: targetOutletIds } };

  const dateRangeWhere = {
    created_at: {
      gte: dateFrom,
      lte: dateTo,
    },
  };

  // Get revenue by payment method
  const payments = await prisma.payment.findMany({
    where: {
      ...baseWhere,
      ...dateRangeWhere,
      status: 'succeeded',
    },
    select: {
      amount: true,
      method: true,
    },
  });

  const revenueByMethod = payments.reduce(
    (acc, p) => {
      const amount = Number(p.amount);
      acc.total += amount;
      if (p.method === 'cash') acc.cash += amount;
      else if (p.method === 'online') acc.online += amount;
      else if (p.method === 'card') acc.card += amount;
      return acc;
    },
    { total: 0, cash: 0, online: 0, card: 0 },
  );

  // Get orders
  const orders = await prisma.order.findMany({
    where: {
      ...baseWhere,
      ...dateRangeWhere,
    },
    select: {
      status: true,
      total: true,
    },
  });

  const orderStats = orders.reduce(
    (acc, o) => {
      acc.total++;
      if (o.status === 'completed') acc.completed++;
      else if (o.status === 'cancelled') acc.cancelled++;
      acc.revenue += Number(o.total);
      return acc;
    },
    { total: 0, completed: 0, cancelled: 0, revenue: 0 },
  );

  // Get items sold
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        ...baseWhere,
        ...dateRangeWhere,
        status: { notIn: ['cancelled'] },
      },
    },
    select: {
      menu_item_id: true,
      item_name: true,
      quantity: true,
      line_total: true,
    },
  });

  const itemStats = orderItems.reduce(
    (acc, item) => {
      const qty = item.quantity;
      const revenue = Number(item.line_total);
      acc.total_sold += qty;
      const existing = acc.byItem.get(item.menu_item_id);
      if (existing) {
        existing.quantity_sold += qty;
        existing.revenue += revenue;
      } else {
        acc.byItem.set(item.menu_item_id, {
          menu_item_id: item.menu_item_id,
          name: item.item_name,
          quantity_sold: qty,
          revenue,
        });
      }
      return acc;
    },
    { total_sold: 0, byItem: new Map<string, { menu_item_id: string; name: string; quantity_sold: number; revenue: number }>() },
  );

  const topItems = Array.from(itemStats.byItem.values())
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, 10)
    .map((item) => ({
      menu_item_id: item.menu_item_id,
      name: item.name,
      quantity_sold: item.quantity_sold,
      revenue: item.revenue.toFixed(2),
    }));

  // Get payment statuses
  const allPayments = await prisma.payment.findMany({
    where: {
      ...baseWhere,
      ...dateRangeWhere,
    },
    select: { status: true },
  });

  const paymentStats = allPayments.reduce(
    (acc, p) => {
      acc.total++;
      if (p.status === 'succeeded') acc.succeeded++;
      else if (p.status === 'failed') acc.failed++;
      else if (p.status === 'pending') acc.pending++;
      return acc;
    },
    { total: 0, succeeded: 0, failed: 0, pending: 0 },
  );

  return {
    period: { from: dateFrom, to: dateTo },
    revenue: {
      total: revenueByMethod.total.toFixed(2),
      cash: revenueByMethod.cash.toFixed(2),
      online: revenueByMethod.online.toFixed(2),
      card: revenueByMethod.card.toFixed(2),
    },
    orders: {
      total: orderStats.total,
      completed: orderStats.completed,
      cancelled: orderStats.cancelled,
      average_order_value: orderStats.total > 0
        ? (orderStats.revenue / orderStats.total).toFixed(2)
        : '0.00',
    },
    items: {
      total_sold: itemStats.total_sold,
      top_items: topItems,
    },
    payments: paymentStats,
  };
}

/**
 * Gets revenue by day for the specified period.
 */
export async function getRevenueByDay(
  actor: StaffActor,
  filters: {
    date_from?: Date;
    date_to?: Date;
    outlet_id?: string;
  } = {},
): Promise<RevenueByDay[]> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  let targetOutletIds = outletIds;
  if (filters.outlet_id) {
    if (!organizationWide && !outletIds.includes(filters.outlet_id)) {
      throw new AppError('FORBIDDEN', 'No access to this outlet', 403);
    }
    targetOutletIds = [filters.outlet_id];
  }

  if (!organizationWide && targetOutletIds.length === 0) {
    return [];
  }

  const dateFrom = filters.date_from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = filters.date_to ?? new Date();

  const baseWhere = organizationWide
    ? { outlet: { organization_id: actor.organization_id } }
    : { outlet_id: { in: targetOutletIds } };

  // Get daily revenue from bills
  const bills = await prisma.bill.findMany({
    where: {
      ...baseWhere,
      status: 'paid',
      paid_at: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    select: {
      total: true,
      paid_at: true,
    },
  });

  // Group by day
  const dailyMap = new Map<string, { revenue: number; orders: number }>();

  for (const bill of bills) {
    if (!bill.paid_at) continue;
    const paidAt = bill.paid_at;
    const dateStr = paidAt.toISOString();
    const date = dateStr.substring(0, 10); // YYYY-MM-DD
    const existing = dailyMap.get(date) || { revenue: 0, orders: 0 };
    existing.revenue += Number(bill.total);
    existing.orders += 1;
    dailyMap.set(date, existing);
  }

  // Fill in missing days with 0
  const results: RevenueByDay[] = [];
  const current = new Date(dateFrom);
  while (current <= dateTo) {
    const dateStr = current.toISOString().substring(0, 10);
    const data = dailyMap.get(dateStr) || { revenue: 0, orders: 0 };
    results.push({
      date: dateStr,
      revenue: data.revenue.toFixed(2),
      orders: data.orders,
      average_order_value: data.orders > 0
        ? (data.revenue / data.orders).toFixed(2)
        : '0.00',
    });
    current.setDate(current.getDate() + 1);
  }

  return results;
}

/**
 * Gets top selling items.
 */
export async function getTopItems(
  actor: StaffActor,
  filters: {
    date_from?: Date;
    date_to?: Date;
    outlet_id?: string;
    limit?: number;
  } = {},
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  let targetOutletIds = outletIds;
  if (filters.outlet_id) {
    if (!organizationWide && !outletIds.includes(filters.outlet_id)) {
      throw new AppError('FORBIDDEN', 'No access to this outlet', 403);
    }
    targetOutletIds = [filters.outlet_id];
  }

  if (!organizationWide && targetOutletIds.length === 0) {
    return [];
  }

  const dateFrom = filters.date_from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = filters.date_to ?? new Date();
  const limit = filters.limit ?? 10;

  const baseWhere = organizationWide
    ? { outlet: { organization_id: actor.organization_id } }
    : { outlet_id: { in: targetOutletIds } };

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        ...baseWhere,
        ...{
          created_at: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        status: { notIn: ['cancelled'] },
      },
    },
    select: {
      menu_item_id: true,
      item_name: true,
      quantity: true,
      line_total: true,
    },
  });

  const itemStats = orderItems.reduce(
    (acc, item) => {
      const qty = item.quantity;
      const revenue = Number(item.line_total);
      const existing = acc.get(item.menu_item_id);
      if (existing) {
        existing.quantity_sold += qty;
        existing.revenue += revenue;
      } else {
        acc.set(item.menu_item_id, {
          menu_item_id: item.menu_item_id,
          name: item.item_name,
          quantity_sold: qty,
          revenue,
        });
      }
      return acc;
    },
    new Map<string, { menu_item_id: string; name: string; quantity_sold: number; revenue: number }>(),
  );

  return Array.from(itemStats.values())
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, limit)
    .map((item) => ({
      menu_item_id: item.menu_item_id,
      name: item.name,
      quantity_sold: item.quantity_sold,
      revenue: item.revenue.toFixed(2),
    }));
}

/**
 * Gets peak hours (orders by hour of day).
 */
export async function getPeakHours(
  actor: StaffActor,
  filters: {
    date_from?: Date;
    date_to?: Date;
    outlet_id?: string;
  } = {},
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  let targetOutletIds = outletIds;
  if (filters.outlet_id) {
    if (!organizationWide && !outletIds.includes(filters.outlet_id)) {
      throw new AppError('FORBIDDEN', 'No access to this outlet', 403);
    }
    targetOutletIds = [filters.outlet_id];
  }

  if (!organizationWide && targetOutletIds.length === 0) {
    return [];
  }

  const dateFrom = filters.date_from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = filters.date_to ?? new Date();

  const baseWhere = organizationWide
    ? { outlet: { organization_id: actor.organization_id } }
    : { outlet_id: { in: targetOutletIds } };

  const orders = await prisma.order.findMany({
    where: {
      ...baseWhere,
      ...{
        created_at: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
    },
    select: {
      created_at: true,
      total: true,
    },
  });

  // Group by hour
  const hourStats = new Map<number, { orders: number; revenue: number }>();

  for (const order of orders) {
    const hour = order.created_at.getHours();
    const existing = hourStats.get(hour) || { orders: 0, revenue: 0 };
    existing.orders += 1;
    existing.revenue += Number(order.total);
    hourStats.set(hour, existing);
  }

  const results = [];
  for (let h = 0; h < 24; h++) {
    const data = hourStats.get(h) || { orders: 0, revenue: 0 };
    results.push({
      hour: h,
      orders: data.orders,
      revenue: data.revenue.toFixed(2),
      average_order_value: data.orders > 0
        ? (data.revenue / data.orders).toFixed(2)
        : '0.00',
    });
  }

  return results;
}

function getEmptySummary(filters: { date_from?: Date; date_to?: Date; outlet_id?: string }): AnalyticsSummary {
  return {
    period: {
      from: filters.date_from ?? new Date(),
      to: filters.date_to ?? new Date(),
    },
    revenue: { total: '0.00', cash: '0.00', online: '0.00', card: '0.00' },
    orders: { total: 0, completed: 0, cancelled: 0, average_order_value: '0.00' },
    items: { total_sold: 0, top_items: [] },
    payments: { total: 0, succeeded: 0, failed: 0, pending: 0 },
  };
}