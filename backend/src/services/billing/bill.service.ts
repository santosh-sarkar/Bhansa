import { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor } from '@/services/staff/access';

function formatDecimal(d: Prisma.Decimal): string {
  return d.toFixed(2);
}

export interface BillDetail {
  id: string;
  outlet_id: string;
  outlet_name: string;
  session_id: string | null;
  table_id: string | null;
  table_label: string | null;
  invoice_number: string;
  subtotal: string;
  tax_amount: string;
  service_charge: string;
  discount_amount: string;
  total: string;
  status: string;
  paid_at: Date | null;
  created_at: Date;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  orders: Array<{
    id: string;
    order_number: number;
    status: string;
    subtotal: string;
    tax_amount: string;
    discount_amount: string;
    total: string;
    created_at: Date;
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
  }>;
}

/**
 * Generates a bill for a session.
 * Calculates subtotal from all non-cancelled orders in the session.
 * Applies outlet tax_percent (VAT) and service_charge_percent.
 * Optional discount (requires billing.manage permission).
 * Creates a Bill record with sequential invoice_number per outlet.
 */
export async function generateBillForSession(
  actor: StaffActor,
  sessionId: string,
  discountAmount?: Prisma.Decimal,
): Promise<BillDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Fetch session with orders and outlet info
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      outlet: {
        select: {
          id: true,
          name: true,
          tax_percent: true,
          service_charge_percent: true,
          organization_id: true,
        },
      },
      orders: {
        where: { status: { notIn: ['cancelled'] } },
        include: {
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
        orderBy: { created_at: 'asc' },
      },
    },
  });

  if (!session) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }

  // Check tenant isolation - session must belong to the same organization
  if (session.outlet.organization_id !== actor.organization_id) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }

  // Check if session belongs to an outlet the user can access
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
  if (!organizationWide && !outletIds.includes(session.outlet_id)) {
    throw new AppError('FORBIDDEN', 'No access to this session', 403);
  }

  // Check if session is in a state where bill can be generated
  if (session.status === 'closed') {
    throw new AppError('VALIDATION_ERROR', 'Session already closed', 400);
  }

  // Calculate subtotal from all non-cancelled orders
  const subtotal = session.orders.reduce(
    (sum, order) => sum + Number(order.subtotal),
    0,
  );

  if (subtotal === 0) {
    throw new AppError('VALIDATION_ERROR', 'No orders to bill', 400);
  }

  const outletTaxPercent = Number(session.outlet.tax_percent);
  const outletServiceChargePercent = Number(session.outlet.service_charge_percent);

  // Calculate tax (VAT)
  const taxAmount = subtotal * (outletTaxPercent / 100);

  // Calculate service charge
  const serviceCharge = subtotal * (outletServiceChargePercent / 100);

  // Apply discount if provided (validate user has billing.manage permission)
  let discount = new Prisma.Decimal(0);
  if (discountAmount && discountAmount.greaterThan(0)) {
    // Check if user has billing.manage permission for discount
    const hasBillingManage = await prisma.staffAssignment.findFirst({
      where: {
        user_id: actor.id,
        role: { rolePermissions: { some: { permission: { code: 'billing.manage' } } } },
        OR: [{ outlet_id: null }, { outlet_id: session.outlet_id }],
      },
      select: { id: true },
    });

    if (!hasBillingManage) {
      throw new AppError('FORBIDDEN', 'Discount requires billing.manage permission', 403);
    }

    discount = discountAmount;
  }

  // Calculate total
  const total = subtotal + taxAmount + serviceCharge - Number(discount);

  // Generate sequential invoice number per outlet
  const lastBill = await prisma.bill.findFirst({
    where: { outlet_id: session.outlet_id },
    orderBy: { invoice_number: 'desc' },
    select: { invoice_number: true },
  });

  const nextInvoiceNumber = lastBill ? parseInt(lastBill.invoice_number) + 1 : 1;
  const invoiceNumber = nextInvoiceNumber.toString().padStart(6, '0');

  // Create the bill
  const bill = await prisma.bill.create({
    data: {
      outlet_id: session.outlet_id,
      session_id: session.id,
      invoice_number: invoiceNumber,
      subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
      tax_amount: new Prisma.Decimal(taxAmount.toFixed(2)),
      service_charge: new Prisma.Decimal(serviceCharge.toFixed(2)),
      discount_amount: discount,
      total: new Prisma.Decimal(total.toFixed(2)),
      created_by: actor.id,
      status: 'open',
    },
    include: {
      outlet: { select: { name: true } },
    },
  });

  // Update session status to bill_requested if not already
  if (session.status !== 'bill_requested') {
    await prisma.tableSession.update({
      where: { id: sessionId },
      data: { status: 'bill_requested' },
    });
  }

  // Update table status to needs_bill
  if (session.table_id) {
    await prisma.diningTable.update({
      where: { id: session.table_id },
      data: { status: 'needs_bill' },
    });
  }

  // Emit socket event for bill requested
  const { getIO } = await import('@/lib/socket');
  const { emitToOutletManagers } = await import('@/lib/socket');
  const io = getIO();
  if (io && session.table_id) {
    emitToOutletManagers(io, session.table.outlet_id, 'session:bill_requested', {
      sessionId: session.id,
      tableLabel: session.table?.label,
      billId: bill.id,
      invoiceNumber: bill.invoice_number,
    });
  }

  // Build response
  return {
    id: bill.id,
    outlet_id: bill.outlet_id,
    outlet_name: bill.outlet.name,
    session_id: bill.session_id,
    table_id: session.table_id,
    table_label: session.table?.label ?? null,
    invoice_number: bill.invoice_number,
    subtotal: formatDecimal(bill.subtotal),
    tax_amount: formatDecimal(bill.tax_amount),
    service_charge: formatDecimal(bill.service_charge),
    discount_amount: formatDecimal(bill.discount_amount),
    total: formatDecimal(bill.total),
    status: bill.status,
    paid_at: bill.paid_at,
    created_at: bill.created_at,
    cancelled_at: bill.cancelled_at,
    cancelled_by: bill.cancelled_by,
    cancel_reason: bill.cancel_reason,
    created_by: bill.created_by,
    orders: session.orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      subtotal: formatDecimal(order.subtotal),
      tax_amount: formatDecimal(order.tax_amount),
      discount_amount: formatDecimal(order.discount_amount),
      total: formatDecimal(order.total),
      created_at: order.created_at,
      items: order.items.map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: formatDecimal(item.unit_price),
        line_total: formatDecimal(item.line_total),
        status: item.status,
        options: item.options as Prisma.InputJsonValue,
        notes: item.notes,
      })),
    })),
  };
}

/**
 * Gets a bill by ID.
 */
export async function getBillById(actor: StaffActor, billId: string): Promise<BillDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      outlet: { select: { name: true, organization_id: true } },
      session: {
        include: {
          table: true,
          orders: {
            where: { status: { notIn: ['cancelled'] } },
            include: {
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
            orderBy: { created_at: 'asc' },
          },
        },
      },
    },
  });

  if (!bill) {
    throw new AppError('NOT_FOUND', 'Bill not found', 404);
  }

  // Check tenant isolation - bill must belong to the same organization
  if (bill.outlet.organization_id !== actor.organization_id) {
    throw new AppError('NOT_FOUND', 'Bill not found', 404);
  }

  // Check if user has access to this bill's outlet
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
  if (!organizationWide && !outletIds.includes(bill.outlet_id)) {
    throw new AppError('FORBIDDEN', 'No access to this bill', 403);
  }

  return {
    id: bill.id,
    outlet_id: bill.outlet_id,
    outlet_name: bill.outlet.name,
    session_id: bill.session_id,
    table_id: bill.session?.table?.id ?? null,
    table_label: bill.session?.table?.label ?? null,
    invoice_number: bill.invoice_number,
    subtotal: formatDecimal(bill.subtotal),
    tax_amount: formatDecimal(bill.tax_amount),
    service_charge: formatDecimal(bill.service_charge),
    discount_amount: formatDecimal(bill.discount_amount),
    total: formatDecimal(bill.total),
    status: bill.status,
    paid_at: bill.paid_at,
    created_at: bill.created_at,
    cancelled_at: bill.cancelled_at,
    cancelled_by: bill.cancelled_by,
    cancel_reason: bill.cancel_reason,
    created_by: bill.created_by,
    orders: bill.session?.orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      subtotal: formatDecimal(order.subtotal),
      tax_amount: formatDecimal(order.tax_amount),
      discount_amount: formatDecimal(order.discount_amount),
      total: formatDecimal(order.total),
      created_at: order.created_at,
      items: order.items.map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: formatDecimal(item.unit_price),
        line_total: formatDecimal(item.line_total),
        status: item.status,
        options: item.options as Prisma.InputJsonValue,
        notes: item.notes,
      })),
    })) ?? [],
  };
}

/**
 * Lists bills with filters.
 */
export async function listBills(
  actor: StaffActor,
  filters: {
    page: number;
    limit: number;
    status?: string;
    outlet_id?: string;
    date_from?: Date;
    date_to?: Date;
  },
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  const where: Prisma.BillWhereInput = organizationWide
    ? { outlet: { organization_id: actor.organization_id } }
    : { outlet_id: { in: outletIds } };

  if (filters.status) {
    where.status = filters.status as 'open' | 'paid' | 'cancelled';
  }

  if (filters.outlet_id) {
    if (!organizationWide && !outletIds.includes(filters.outlet_id)) {
      throw new AppError('FORBIDDEN', 'No access to this outlet', 403);
    }
    where.outlet_id = filters.outlet_id;
  }

  if (filters.date_from || filters.date_to) {
    where.created_at = {};
    if (filters.date_from) {
      where.created_at = { ...where.created_at, gte: filters.date_from };
    }
    if (filters.date_to) {
      where.created_at = { ...where.created_at, lte: filters.date_to };
    }
  }

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      include: {
        outlet: { select: { name: true } },
        session: { select: { table: { select: { id: true, label: true } } } },
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.bill.count({ where }),
  ]);

  return {
    bills: bills.map((bill) => ({
      id: bill.id,
      outlet_id: bill.outlet_id,
      outlet_name: bill.outlet.name,
      session_id: bill.session_id,
      table_id: bill.session?.table?.id ?? null,
      table_label: bill.session?.table?.label ?? null,
      invoice_number: bill.invoice_number,
      subtotal: formatDecimal(bill.subtotal),
      tax_amount: formatDecimal(bill.tax_amount),
      service_charge: formatDecimal(bill.service_charge),
      discount_amount: formatDecimal(bill.discount_amount),
      total: formatDecimal(bill.total),
      status: bill.status,
      paid_at: bill.paid_at,
      created_at: bill.created_at,
      cancelled_at: bill.cancelled_at,
      cancelled_by: bill.cancelled_by,
      cancel_reason: bill.cancel_reason,
      created_by: bill.created_by,
    })),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}