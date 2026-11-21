import type { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getManageableOutletIds, type StaffActor, getActorRoleCode } from '@/services/staff/access';
import { transitionOrderStatus, transitionOrderItemStatus, type OrderStatus, type OrderItemStatus } from '@/services/order/transitions';

export interface OrderListItem {
  id: string;
  order_number: number;
  order_type: string;
  status: string;
  table_id: string | null;
  table_label: string | null;
  session_id: string | null;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total: string;
  created_at: Date;
  confirmed_at: Date | null;
  items_count: number;
}

export interface OrderDetail extends OrderListItem {
  outlet_id: string;
  outlet_name: string;
  table_id: string | null;
  session_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  tax_percent: string;
  service_charge_percent: string;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  confirmed_by: string | null;
  cancelled_by: string | null;
  items_count: number;
  items: Array<{
    id: string;
    menu_item_id: string;
    item_name: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    status: string;
    options: Prisma.InputJsonValue;
    notes: string | null;
  }>;
}

async function getActorWithRole(actor: StaffActor) {
  const role = await getActorRoleCode(actor.id, actor.outletId ?? '');
  return { ...actor, role, outletId: actor.outletId };
}

export async function listOrders(
  actor: StaffActor,
  filters: {
    page: number;
    limit: number;
    status?: string;
    table_id?: string;
    date_from?: Date;
    date_to?: Date;
    session_id?: string;
  },
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getManageableOutletIds(actor);

  const where: Prisma.OrderWhereInput = {
    outlet_id: { in: [actor.outletId].filter(Boolean) as string[] },
  };

  if (filters.status) {
    where.status = filters.status as any;
  }
  if (filters.table_id) {
    where.table_id = filters.table_id;
  }
  if (filters.session_id) {
    where.session_id = filters.session_id;
  }
  if (filters.date_from || filters.date_to) {
    where.created_at = {};
    if (filters.date_from) where.created_at.gte = filters.date_from;
    if (filters.date_to) where.created_at.lte = filters.date_to;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        table: { select: { label: true } },
        _count: { select: { items: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: orders.map(function(order) {
      return {
        id: order.id,
        order_number: order.order_number,
        order_type: order.order_type,
        status: order.status,
        table_id: order.table_id,
        table_label: order.table?.label ?? null,
        session_id: order.session_id,
        subtotal: order.subtotal.toString(),
        tax_amount: order.tax_amount.toString(),
        discount_amount: order.discount_amount.toString(),
        total: order.total.toString(),
        created_at: order.created_at,
        confirmed_at: order.confirmed_at,
        items_count: order._count.items,
      };
    }),
    total: total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function getOrder(
  actor: StaffActor,
  orderId: string,
): Promise<OrderDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      outlet_id: actor.outletId ?? undefined,
    },
    include: {
      outlet: { select: { id: true, name: true, tax_percent: true, service_charge_percent: true } },
      table: { select: { label: true } },
      session: { select: { id: true } },
      items: {
        select: {
          id: true,
          menu_item_id: true,
          item_name: true,
          quantity: true,
          unit_price: true,
          line_total: true,
          status: true,
          options: true,
          notes: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404);
  }

  return {
    id: order.id,
    order_number: order.order_number,
    order_type: order.order_type,
    status: order.status,
    table_id: order.table_id,
    table_label: order.table?.label ?? null,
    session_id: order.session_id,
    outlet_id: order.outlet.id,
    outlet_name: order.outlet.name,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    notes: order.notes,
    tax_percent: order.outlet.tax_percent.toString(),
    service_charge_percent: order.outlet.service_charge_percent.toString(),
    subtotal: order.subtotal.toString(),
    tax_amount: order.tax_amount.toString(),
    discount_amount: order.discount_amount.toString(),
    total: order.total.toString(),
    created_at: order.created_at,
    confirmed_at: order.confirmed_at,
    cancelled_at: order.cancelled_at,
    cancel_reason: order.cancel_reason,
    confirmed_by: order.confirmed_by,
    cancelled_by: null,
    items_count: order.items.length,
    items: order.items.map(function(item) {
      return {
        id: item.id,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price.toString(),
        line_total: item.line_total.toString(),
        status: item.status,
        options: item.options as Prisma.InputJsonValue,
        notes: item.notes,
      };
    }),
  };
}

export async function confirmOrder(
  actor: StaffActor,
  orderId: string,
) {
  const role = await getActorRoleCode(actor.id, actor.outletId ?? null);
  return transitionOrderStatus(
    orderId,
    'placed',
    {
      userId: actor.id,
      role,
      outletId: actor.outletId ?? null,
      organizationId: actor.organization_id ?? '',
    },
  );
}

export async function rejectOrder(
  actor: StaffActor,
  orderId: string,
  reason: string,
) {
  if (!reason || reason.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Rejection reason is required', 400);
  }

  const role = await getActorRoleCode(actor.id, actor.outletId ?? null);
  return transitionOrderStatus(
    orderId,
    'cancelled',
    {
      userId: actor.id,
      role,
      outletId: actor.outletId ?? null,
      organizationId: actor.organization_id ?? '',
    },
    reason.trim(),
  );
}

export async function updateOrderStatus(
  actor: StaffActor,
  orderId: string,
  newStatus: string,
  reason?: string,
) {
  const role = await getActorRoleCode(actor.id, actor.outletId ?? null);
  return transitionOrderStatus(
    orderId,
    newStatus as any,
    {
      userId: actor.id,
      role,
      outletId: actor.outletId ?? null,
      organizationId: actor.organization_id ?? '',
    },
    reason,
  );
}

export async function cancelOrder(
  actor: StaffActor,
  orderId: string,
  reason: string,
) {
  if (!reason || reason.trim().length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Cancellation reason is required', 400);
  }

  const role = await getActorRoleCode(actor.id, actor.outletId ?? null);
  return transitionOrderStatus(
    orderId,
    'cancelled',
    {
      userId: actor.id,
      role,
      outletId: actor.outletId ?? null,
      organizationId: actor.organization_id ?? '',
    },
    reason.trim(),
  );
}

export async function updateOrderItemStatus(
  actor: StaffActor,
  itemId: string,
  newStatus: string,
) {
  const role = await getActorRoleCode(actor.id, actor.outletId ?? null);
  return transitionOrderItemStatus(
    itemId,
    newStatus as any,
    {
      userId: actor.id,
      role,
      outletId: actor.outletId ?? null,
    },
  );
}

export async function getKitchenBoard(
  actor: StaffActor,
  outletId?: string,
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const outletIds = [actor.outletId].filter(Boolean) as string[];
  const targetOutletIds = outletId ? [outletId] : outletIds;

  const orders = await prisma.order.findMany({
    where: {
      outlet_id: { in: outletIds },
      status: { in: ['placed', 'preparing', 'ready'] },
    },
    include: {
      table: { select: { id: true, label: true } },
      items: {
        where: { status: { in: ['placed', 'preparing', 'ready'] } },
        select: {
          id: true,
          item_name: true,
          quantity: true,
          status: true,
          options: true,
          notes: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  const result = [];
  for (const order of orders) {
    const mappedItems = [];
    for (const item of order.items) {
      mappedItems.push({
        id: item.id,
        name: item.item_name,
        quantity: item.quantity,
        status: item.status,
        options: item.options,
      });
    }

    result.push({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      table_label: order.table?.label ?? 'Takeaway',
      created_at: order.created_at,
      items: mappedItems,
    });
  }

  return result;
}

export async function listSessions(
  actor: StaffActor,
  filters: {
    page: number;
    limit: number;
    outlet_id?: string;
    status?: string;
  },
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const targetOutletIds = [actor.outletId].filter(Boolean) as string[];

  const where: any = {
    outlet_id: { in: [actor.outletId].filter(Boolean) as string[] },
  };

  if (filters.status) {
    where.status = filters.status;
  } else {
    where.status = { not: 'closed' };
  }

  const [sessions, total] = await Promise.all([
    prisma.tableSession.findMany({
      where,
      include: {
        table: { select: { id: true, label: true, seats: true, status: true } },
        outlet: { select: { id: true, name: true } },
        orders: {
          where: { status: { not: 'cancelled' } },
          select: { id: true, order_number: true, status: true, total: true, created_at: true },
        },
      },
      orderBy: { opened_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.tableSession.count({ where }),
  ]);

  return {
    items: sessions.map(function(s) {
      return {
        id: s.id,
        outlet_id: s.outlet_id,
        outlet_name: s.outlet.name,
        table_id: s.table_id,
        table_label: s.table.label,
        table_seats: s.table.seats,
        table_status: s.table.status,
        status: s.status,
        opened_at: s.opened_at,
        closed_at: s.closed_at,
        orders: s.orders.map(function(o) {
          return {
            id: o.id,
            order_number: o.order_number,
            status: o.status,
            total: o.total.toString(),
            created_at: o.created_at,
          };
        }),
      };
    }),
    total: total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function requestBill(
  actor: StaffActor,
  sessionId: string,
) {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: { table: true },
  });

  if (!session) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }

  await prisma.tableSession.update({
    where: { id: sessionId },
    data: { status: 'bill_requested' },
  });

  if (session.table_id) {
    await prisma.diningTable.update({
      where: { id: session.table_id },
      data: { status: 'needs_bill' },
    });
  }

  return { success: true };
}

export async function closeSession(
  actor: StaffActor,
  sessionId: string,
) {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: { table: true, orders: true },
  });

  if (!session) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }

  const unpaidOrders = session.orders.filter(
    function(o) { return o.status !== 'completed' && o.status !== 'cancelled'; },
  );

  if (unpaidOrders.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Cannot close session with unpaid orders', 400);
  }

  await prisma.$transaction(async function(tx) {
    await tx.tableSession.update({
      where: { id: sessionId },
      data: { status: 'closed', closed_at: new Date() },
    });

    if (session.table_id) {
      await tx.diningTable.update({
        where: { id: session.table_id },
        data: { status: 'free' },
      });
    }
  });

  return { success: true };
}