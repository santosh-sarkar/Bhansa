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

/**
 * Generates a printable HTML invoice for a bill.
 * Returns HTML string that can be printed directly or converted to PDF.
 */
export async function getBillInvoiceHtml(actor: StaffActor, billId: string): Promise<string> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      outlet: {
        select: {
          name: true,
          address: true,
          phone: true,
          organization_id: true,
          tax_percent: true,
          service_charge_percent: true,
        },
      },
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
      payments: {
        where: { status: 'succeeded' },
        select: {
          method: true,
          amount: true,
          created_at: true,
          transaction_uuid: true,
        },
      },
    },
  });

  if (!bill) {
    throw new AppError('NOT_FOUND', 'Bill not found', 404);
  }

  // Check tenant isolation
  if (bill.outlet.organization_id !== actor.organization_id) {
    throw new AppError('NOT_FOUND', 'Bill not found', 404);
  }

  // Check if user has access to this outlet
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
  if (!organizationWide && !outletIds.includes(bill.outlet_id)) {
    throw new AppError('FORBIDDEN', 'No access to this bill', 403);
  }

  const outlet = bill.outlet;
  const session = bill.session;
  const orders = session?.orders ?? [];
  const payments = bill.payments;
  const taxPercent = Number(outlet.tax_percent);
  const serviceChargePercent = Number(outlet.service_charge_percent);

  // Format date
  const formatDate = (date: Date | null): string => {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-NP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Build order items HTML
  let itemsHtml = '';
  let itemIndex = 1;
  for (const order of orders) {
    for (const item of order.items) {
      itemsHtml += `
        <tr>
          <td class="text-center">${itemIndex++}</td>
          <td>${item.item_name}</td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-right">${formatDecimal(item.unit_price)}</td>
          <td class="text-right">${formatDecimal(item.line_total)}</td>
        </tr>`;
    }
  }

  // Build payments HTML
  let paymentsHtml = '';
  if (payments.length > 0) {
    for (const payment of payments) {
      paymentsHtml += `
        <tr>
          <td>${formatDate(payment.created_at)}</td>
          <td>${payment.method.toUpperCase()}</td>
          <td class="text-right">${formatDecimal(payment.amount)}</td>
          <td>${payment.transaction_uuid?.substring(0, 12) ?? '—'}</td>
        </tr>`;
    }
  } else {
    paymentsHtml = '<tr><td colspan="4" class="text-center">No payments recorded</td></tr>';
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Number(bill.total) - totalPaid;

  // Generate HTML
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${bill.invoice_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; }
    .invoice { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
    .company-info h1 { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
    .company-info p { font-size: 11px; color: #666; }
    .invoice-title { text-align: right; }
    .invoice-title h2 { font-size: 28px; font-weight: bold; color: #333; }
    .invoice-title .invoice-number { font-size: 14px; color: #666; margin-top: 5px; }
    .details { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .detail-box { width: 48%; }
    .detail-box h4 { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
    .detail-box p { font-size: 11px; margin: 2px 0; }
    .detail-box .label { font-weight: bold; display: inline-block; width: 100px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
    th, td { padding: 8px 10px; border: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals { width: 100%; max-width: 400px; margin-left: auto; margin-bottom: 20px; }
    .totals td { padding: 6px 10px; border: none; border-bottom: 1px solid #eee; }
    .totals .total-row { font-weight: bold; font-size: 13px; border-top: 2px solid #333; border-bottom: 2px solid #333; }
    .payments-section { margin-top: 30px; }
    .payments-section h4 { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; }
    .status-badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .status-paid { background-color: #d4edda; color: #155724; }
    .status-open { background-color: #fff3cd; color: #856404; }
    .status-cancelled { background-color: #f8d7da; color: #721c24; }
    @media print {
      body { padding: 0; }
      .invoice { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-info">
        <h1>${outlet.name}</h1>
        ${outlet.address ? `<p>${outlet.address}</p>` : ''}
        ${outlet.phone ? `<p>Phone: ${outlet.phone}</p>` : ''}
      </div>
      <div class="invoice-title">
        <h2>INVOICE</h2>
        <div class="invoice-number">#${bill.invoice_number}</div>
      </div>
    </div>

    <div class="details">
      <div class="detail-box">
        <h4>Bill To</h4>
        <p><span class="label">Table:</span> ${session?.table?.label ?? 'N/A'}</p>
        <p><span class="label">Session:</span> ${session?.id ?? 'N/A'}</p>
        <p><span class="label">Date:</span> ${formatDate(bill.created_at)}</p>
      </div>
      <div class="detail-box">
        <h4>Status</h4>
        <p><span class="label">Bill Status:</span> <span class="status-badge status-${bill.status}">${bill.status}</span></p>
        <p><span class="label">Payment:</span> ${bill.paid_at ? 'Paid' : 'Pending'}</p>
        <p><span class="label">Tax Rate:</span> ${taxPercent}% VAT + ${serviceChargePercent}% Service</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width: 5%;">#</th>
          <th style="width: 45%;">Item</th>
          <th class="text-center" style="width: 10%;">Qty</th>
          <th class="text-right" style="width: 20%;">Unit Price</th>
          <th class="text-right" style="width: 20%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || '<tr><td colspan="5" class="text-center">No items</td></tr>'}
      </tbody>
    </table>

    <table class="totals">
      <tbody>
        <tr>
          <td>Subtotal</td>
          <td class="text-right">${formatDecimal(bill.subtotal)}</td>
        </tr>
        <tr>
          <td>VAT (${taxPercent}%)</td>
          <td class="text-right">${formatDecimal(bill.tax_amount)}</td>
        </tr>
        <tr>
          <td>Service Charge (${serviceChargePercent}%)</td>
          <td class="text-right">${formatDecimal(bill.service_charge)}</td>
        </tr>
        ${Number(bill.discount_amount) > 0 ? `
        <tr>
          <td>Discount</td>
          <td class="text-right">-${formatDecimal(bill.discount_amount)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td>Grand Total</td>
          <td class="text-right">${formatDecimal(bill.total)}</td>
        </tr>
      </tbody>
    </table>

    <div class="payments-section">
      <h4>Payments</h4>
      <table>
        <thead>
          <tr>
            <th style="width: 30%;">Date</th>
            <th style="width: 20%;">Method</th>
            <th class="text-right" style="width: 25%;">Amount</th>
            <th style="width: 25%;">Ref</th>
          </tr>
        </thead>
        <tbody>
          ${paymentsHtml}
        </tbody>
      </table>
      ${totalPaid > 0 ? `
      <table class="totals" style="max-width: 400px; margin-left: auto; margin-top: 10px;">
        <tbody>
          <tr>
            <td>Total Paid</td>
            <td class="text-right">${formatDecimal(new Prisma.Decimal(totalPaid))}</td>
          </tr>
          <tr class="total-row">
            <td>Balance Due</td>
            <td class="text-right">${formatDecimal(new Prisma.Decimal(balanceDue))}</td>
          </tr>
        </tbody>
      </table>` : ''}
    </div>

    <div class="footer">
      <p>Thank you for dining with us!</p>
      <p>This is a computer-generated invoice. No signature required.</p>
      <p>Printed on ${formatDate(new Date())}</p>
    </div>
  </div>
</body>
</html>
  `;
}