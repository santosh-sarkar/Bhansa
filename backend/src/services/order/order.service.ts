import { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor, getActorRoleCode } from '@/services/staff/access';

function formatDecimal(d: Prisma.Decimal): string {
  return d.toFixed(2);
}
import { getEffectiveMenuForOutlet } from '@/services/menu/menu.service';
import {
  transitionOrderStatus,
  transitionOrderItemStatus,
  type OrderStatus,
  type OrderItemStatus,
} from '@/services/order/transitions';
import { getIO } from '@/lib/socket';
import { emitToOutletWaiters, emitToOutletKitchen, emitToOutletManagers } from '@/lib/socket';

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
  rejected_by: string | null;
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

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

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

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        table: { select: { id: true, label: true } },
        session: { select: { id: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: items.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      order_type: o.order_type,
      status: o.status,
      table_id: o.table_id,
      table_label: o.table?.label ?? null,
      session_id: o.session_id,
      subtotal: o.subtotal.toString(),
      tax_amount: o.tax_amount.toString(),
      discount_amount: o.discount_amount.toString(),
      total: o.total.toString(),
      created_at: o.created_at,
      confirmed_at: o.confirmed_at,
      items_count: (o as any).items_count ?? 0,
    })),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function getOrder(actor: StaffActor, orderId: string): Promise<OrderDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      outlet: { select: { id: true, name: true, tax_percent: true, service_charge_percent: true } },
      table: { select: { id: true, label: true } },
      session: { select: { id: true } },
      items: {
        include: {
          menuItem: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!order) {
    throw new AppError('NOT_FOUND', 'Order not found', 404);
  }

  const outletIds = await getAccessibleOutletIds(actor);
  if (!outletIds.organizationWide && !outletIds.outletIds.includes(order.outlet_id)) {
    throw new AppError('FORBIDDEN', 'Not authorized for this outlet', 403);
  }

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
    cancelled_at: order.cancelled_at,
    cancel_reason: order.cancel_reason,
    confirmed_by: order.confirmed_by,
    rejected_by: order.rejected_by,
    items_count: order.items.length,
    outlet_id: order.outlet_id,
    outlet_name: order.outlet.name,
    tax_percent: order.outlet.tax_percent.toString(),
    service_charge_percent: order.outlet.service_charge_percent.toString(),
    customer_name: order.customer_name ?? null,
    customer_phone: order.customer_phone ?? null,
    notes: order.notes,
    items: order.items.map((item) => ({
      id: item.id,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price.toString(),
      line_total: item.line_total.toString(),
      status: item.status,
      options: item.options as Prisma.InputJsonValue,
      notes: item.notes,
    })),
  };
}

export async function confirmOrder(actor: StaffActor, orderId: string) {
  const role = await getActorRoleCode(actor.id, actor.outletId ?? null);
  return transitionOrderStatus(orderId, 'placed', {
    userId: actor.id,
    role,
    outletId: actor.outletId ?? null,
    organizationId: actor.organization_id ?? '',
  });
}

export async function rejectOrder(actor: StaffActor, orderId: string, reason: string) {
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

export async function cancelOrder(actor: StaffActor, orderId: string, reason: string) {
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

export async function updateOrderItemStatus(actor: StaffActor, itemId: string, newStatus: string) {
  const role = await getActorRoleCode(actor.id, actor.outletId ?? null);
  return transitionOrderItemStatus(itemId, newStatus as any, {
    userId: actor.id,
    role,
    outletId: actor.outletId ?? null,
  });
}

export async function getKitchenBoard(actor: StaffActor, outletId?: string) {
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
        notes: item.notes,
      });
    }
    result.push({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      table_label: order.table?.label,
      table_id: order.table_id,
      created_at: order.created_at,
      items: mappedItems,
    });
  }

  return { orders: result };
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
    items: sessions.map(function (s) {
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
        orders: s.orders.map(function (o) {
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

export async function requestBill(actor: StaffActor, sessionId: string) {
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

  // Emit socket event for bill requested
  const io = getIO();
  if (io && session.table_id) {
    emitToOutletManagers(io, session.table.outlet_id, 'session:bill_requested', {
      sessionId: session.id,
      tableLabel: session.table.label,
    });
  }

  return { success: true };
}

export async function closeSession(actor: StaffActor, sessionId: string) {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: { table: true, orders: true },
  });

  if (!session) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }

  const unpaidOrders = session.orders.filter(function (o) {
    return o.status !== 'completed' && o.status !== 'cancelled';
  });

  if (unpaidOrders.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Cannot close session with unpaid orders', 400);
  }

  await prisma.$transaction(async function (tx) {
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

  // Emit socket event for session closed
  const io = getIO();
  if (io && session.table_id) {
    emitToOutletManagers(io, session.table.outlet_id, 'session:closed', {
      sessionId: session.id,
      tableLabel: session.table.label,
    });
    emitToOutletWaiters(io, session.table.outlet_id, 'session:closed', {
      sessionId: session.id,
      tableLabel: session.table.label,
    });
  }

  return { success: true };
}

interface StaffOrderItemInput {
  menuItemId: string;
  quantity: number;
  options?: Array<{
    optionId: string;
    quantity: number;
  }>;
  notes?: string;
}

interface StaffOrderInput {
  tableId: string;
  items: StaffOrderItemInput[];
  notes?: string;
}

interface StaffOrderResult {
  order: {
    id: string;
    order_number: number;
    status: string;
    subtotal: string;
    tax_amount: string;
    discount_amount: string;
    total: string;
    created_at: Date;
    notes: string | null;
    items: Array<{
      id: string;
      menu_item_id: string;
      name: string;
      quantity: number;
      unit_price: string;
      line_total: string;
      status: string;
      options: any;
      notes: string | null;
    }>;
  };
}

/**
 * Creates a staff order for a table (auto-confirmed to 'placed' status).
 * Waiters and Managers can use this to place orders on behalf of guests.
 * Validates items against effective menu, calculates pricing server-side,
 * creates order with 'placed' status, per-outlet-per-day order number.
 * Sets table status to 'occupied'.
 */
export async function createStaffOrder(
  actor: StaffActor,
  input: StaffOrderInput,
): Promise<StaffOrderResult> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Validate table access
  const table = await prisma.diningTable.findUnique({
    where: { id: input.tableId },
    select: {
      id: true,
      outlet_id: true,
      label: true,
      status: true,
      is_active: true,
    },
  });

  if (!table) {
    throw new AppError('NOT_FOUND', 'Table not found', 404);
  }

  if (!table.is_active) {
    throw new AppError('VALIDATION_ERROR', 'Table is not active', 400);
  }

  // Check if actor has access to this outlet
  const outletIds = await getAccessibleOutletIds(actor);
  if (!outletIds.organizationWide && !outletIds.outletIds.includes(table.outlet_id)) {
    throw new AppError('FORBIDDEN', 'Not authorized for this outlet', 403);
  }

  // Get effective menu for the outlet to validate items and get pricing
  const effectiveMenu = await getEffectiveMenuForOutlet(table.outlet_id);

  // Validate items and calculate pricing
  let subtotal = new Prisma.Decimal(0);
  const orderItems: Array<{
    menu_item_id: string;
    outlet_id: string;
    item_name: string;
    quantity: number;
    unit_price: Prisma.Decimal;
    line_total: Prisma.Decimal;
    status: OrderItemStatus;
    options: any;
    notes: string | null;
  }> = [];

  for (const itemInput of input.items) {
    // Find menu item in effective menu
    let menuItem: any = null;
    for (const category of effectiveMenu.categories) {
      const found = category.items.find((i) => i.id === itemInput.menuItemId);
      if (found) {
        menuItem = found;
        break;
      }
    }

    if (!menuItem) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Menu item ${itemInput.menuItemId} not found or not available`,
        404,
      );
    }

    if (!menuItem.is_available) {
      throw new AppError('VALIDATION_ERROR', `Menu item ${menuItem.name} is not available`, 400);
    }

    // Validate options if provided
    let optionsTotal = new Prisma.Decimal(0);
    const validatedOptions: any[] = [];

    if (itemInput.options && itemInput.options.length > 0) {
      // Fetch options for this menu item from database
      const dbOptions = await prisma.menuItemOption.findMany({
        where: {
          menu_item_id: menuItem.id,
          is_active: true,
        },
        select: {
          id: true,
          name: true,
          kind: true,
          price_delta: true,
          is_active: true,
        },
      });

      for (const optionInput of itemInput.options) {
        const option = dbOptions.find((o) => o.id === optionInput.optionId);
        if (!option) {
          throw new AppError(
            'VALIDATION_ERROR',
            `Option ${optionInput.optionId} not found for item ${menuItem.name}`,
            404,
          );
        }
        if (!option.is_active) {
          throw new AppError('VALIDATION_ERROR', `Option ${option.name} is not active`, 400);
        }
        optionsTotal = optionsTotal.add(option.price_delta);
        validatedOptions.push({
          option_id: option.id,
          name: option.name,
          price_delta: option.price_delta,
          quantity: optionInput.quantity,
        });
      }
    }

    const unitPrice = new Prisma.Decimal(menuItem.base_price).add(optionsTotal);
    const lineTotal = unitPrice.mul(itemInput.quantity);
    subtotal = subtotal.add(lineTotal);

    orderItems.push({
      menu_item_id: menuItem.id,
      outlet_id: table.outlet_id,
      item_name: menuItem.name,
      quantity: itemInput.quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      status: 'placed' as OrderItemStatus,
      options: validatedOptions,
      notes: itemInput.notes ?? null,
    });
  }

  // Calculate tax and service charge
  const outlet = await prisma.outlet.findUnique({
    where: { id: table.outlet_id },
    select: { tax_percent: true, service_charge_percent: true },
  });

  if (!outlet) {
    throw new AppError('NOT_FOUND', 'Outlet not found', 404);
  }

  const taxPercent = outlet.tax_percent ?? new Prisma.Decimal('13.00');
  const servicePercent = outlet.service_charge_percent ?? new Prisma.Decimal('10.00');

  const taxAmount = subtotal.mul(taxPercent).div(100);
  const serviceAmount = subtotal.mul(servicePercent).div(100);
  const total = subtotal.add(taxAmount).add(serviceAmount);

  // Get next order number for this outlet and business date
  const businessDate = new Date();
  businessDate.setHours(0, 0, 0, 0);

  const lastOrder = await prisma.order.findFirst({
    where: {
      outlet_id: table.outlet_id,
      business_date: businessDate,
    },
    orderBy: { order_number: 'desc' },
    select: { order_number: true },
  });

  const orderNumber = (lastOrder?.order_number ?? 0) + 1;

  // Create order with items in a transaction (increase timeout to 15 seconds)
  const createdOrder = await prisma.$transaction(
    async (tx) => {
      // Find or create a table session for this table
      let tableSession = await tx.tableSession.findFirst({
        where: {
          table_id: input.tableId,
          status: 'open',
        },
        select: { id: true },
      });

      if (!tableSession) {
        tableSession = await tx.tableSession.create({
          data: {
            outlet_id: table.outlet_id,
            table_id: input.tableId,
            guest_token: `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            status: 'open',
          },
          select: { id: true },
        });
      }

      // Update table status to occupied
      await tx.diningTable.update({
        where: { id: input.tableId },
        data: { status: 'occupied' },
      });

      const order = await tx.order.create({
        data: {
          outlet_id: table.outlet_id,
          order_number: orderNumber,
          order_type: 'dine_in',
          status: 'placed', // Auto-confirmed
          table_id: input.tableId,
          session_id: tableSession.id,
          subtotal,
          tax_amount: taxAmount,
          discount_amount: new Prisma.Decimal(0),
          total,
          notes: input.notes ?? null,
          business_date: businessDate,
          confirmed_at: new Date(),
          confirmed_by: actor.id,
          items: {
            create: orderItems.map((item) => ({
              menuItem: { connect: { id: item.menu_item_id } },
              outlet: { connect: { id: item.outlet_id } },
              item_name: item.item_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
              status: 'placed' as OrderItemStatus,
              options: item.options,
              notes: item.notes,
            })),
          },
        },
        include: {
          items: {
            include: {
              menuItem: { select: { id: true, name: true } },
            },
          },
        },
      });

      return order;
    },
    { timeout: 15000 },
  );

  // Emit socket events for order:confirmed and order:status_changed
  const io = getIO();
  if (io) {
    const confirmedEvent = {
      orderId: createdOrder.id,
      items: createdOrder.items.map((item) => ({
        menuItemId: item.menu_item_id,
        name: item.item_name,
        quantity: item.quantity,
      })),
      createdAt: createdOrder.confirmed_at?.toISOString() ?? new Date().toISOString(),
    };
    emitToOutletKitchen(io, table.outlet_id, 'order:confirmed', confirmedEvent);

    // Also emit order:status_changed
    const statusChangedEvent = {
      orderId: createdOrder.id,
      status: 'placed',
      previousStatus: 'pending_confirmation', // Conceptual previous status
    };
    emitToOutletWaiters(io, table.outlet_id, 'order:status_changed', statusChangedEvent);
    emitToOutletKitchen(io, table.outlet_id, 'order:status_changed', statusChangedEvent);
    emitToOutletManagers(io, table.outlet_id, 'order:status_changed', statusChangedEvent);
  }

  return {
    order: {
      id: createdOrder.id,
      order_number: createdOrder.order_number,
      status: createdOrder.status,
      subtotal: formatDecimal(createdOrder.subtotal),
      tax_amount: formatDecimal(createdOrder.tax_amount),
      discount_amount: formatDecimal(createdOrder.discount_amount),
      total: formatDecimal(createdOrder.total),
      created_at: createdOrder.created_at,
      notes: createdOrder.notes,
      items: createdOrder.items.map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id,
        name: item.item_name,
        quantity: item.quantity,
        unit_price: formatDecimal(item.unit_price),
        line_total: formatDecimal(item.line_total),
        status: item.status,
        options: item.options,
        notes: item.notes,
      })),
    },
  };
}
