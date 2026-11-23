import type { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getAccessibleOutletIds, type StaffActor } from '@/services/staff/access';
import { getIO } from '@/lib/socket';
import { emitToOutletManagers, emitToOutletWaiters } from '@/lib/socket';
import { generateSecureToken } from '@/utils/token';

function formatDecimal(d: Prisma.Decimal): string {
  return d.toFixed(2);
}

export interface PaymentDetail {
  id: string;
  outlet_id: string;
  bill_id: string;
  method: string;
  status: string;
  amount: string;
  provider_ref: string | null;
  idempotency_key: string | null;
  transaction_uuid: string | null;
  recorded_at: Date;
  verified_at: Date | null;
  recorded_by: string | null;
}

/**
 * Records a cash payment for a bill.
 * Updates bill status to paid, closes session, frees table, completes orders.
 */
export async function recordCashPayment(
  actor: StaffActor,
  billId: string,
  amount: Prisma.Decimal,
  idempotencyKey?: string,
): Promise<PaymentDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  // Fetch bill with session and outlet info
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      outlet: {
        select: {
          id: true,
          name: true,
          organization_id: true,
        },
      },
      session: {
        include: {
          table: true,
          orders: {
            where: { status: { notIn: ['cancelled', 'completed'] } },
          },
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

  // Check if bill is already paid
  if (bill.status === 'paid') {
    throw new AppError('VALIDATION_ERROR', 'Bill already paid', 400);
  }

  // Validate amount matches bill total
  if (amount.lessThan(bill.total) || amount.greaterThan(bill.total)) {
    throw new AppError('VALIDATION_ERROR', `Payment amount must equal bill total (${formatDecimal(bill.total)})`, 400);
  }

  // Check if session has unpaid orders (orders that aren't completed/cancelled)
  if (bill.session && bill.session.orders.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Cannot record payment while session has uncompleted orders', 400);
  }

  // Generate transaction UUID for idempotency
  const transactionUuid = idempotencyKey || generateSecureToken();

  // Create payment record and update bill/session/table in a transaction
  const payment = await prisma.$transaction(async (tx) => {
    // Check idempotency key
    if (idempotencyKey) {
      const existingPayment = await tx.payment.findUnique({
        where: { idempotency_key: idempotencyKey },
      });
      if (existingPayment) {
        throw new AppError('CONFLICT', 'Payment with this idempotency key already exists', 409);
      }
    }

    // Create payment record
    const newPayment = await tx.payment.create({
      data: {
        outlet_id: bill.outlet_id,
        bill_id: bill.id,
        method: 'cash',
        status: 'succeeded',
        amount: amount,
        transaction_uuid: transactionUuid,
        idempotency_key: idempotencyKey ?? null,
        recorded_by: actor.id,
        verified_at: new Date(),
      },
    });

    // Update bill status to paid
    await tx.bill.update({
      where: { id: billId },
      data: {
        status: 'paid',
        paid_at: new Date(),
      },
    });

    // If session exists, close it and free the table
    if (bill.session_id) {
      // Mark all orders in session as completed
      await tx.order.updateMany({
        where: {
          session_id: bill.session_id,
          status: { notIn: ['cancelled', 'completed'] },
        },
        data: {
          status: 'completed',
        },
      });

      // Close session
      await tx.tableSession.update({
        where: { id: bill.session_id },
        data: { status: 'closed', closed_at: new Date() },
      });

      // Free the table
      if (bill.session?.table_id) {
        await tx.diningTable.update({
          where: { id: bill.session.table_id },
          data: { status: 'free' },
        });
      }
    }

    return newPayment;
  });

  // Emit socket events for session closed and payment recorded
  const io = getIO();
  if (io && bill.session?.table_id) {
    emitToOutletManagers(io, bill.session.table.outlet_id, 'payment:recorded', {
      billId: bill.id,
      invoiceNumber: bill.invoice_number,
      amount: formatDecimal(amount),
      method: 'cash',
    });

    emitToOutletManagers(io, bill.session.table.outlet_id, 'session:closed', {
      sessionId: bill.session_id,
      tableLabel: bill.session.table.label,
    });

    emitToOutletWaiters(io, bill.session.table.outlet_id, 'session:closed', {
      sessionId: bill.session_id,
      tableLabel: bill.session.table.label,
    });
  }

  return {
    id: payment.id,
    outlet_id: payment.outlet_id,
    bill_id: payment.bill_id,
    method: payment.method,
    status: payment.status,
    amount: formatDecimal(payment.amount),
    provider_ref: payment.provider_ref,
    idempotency_key: payment.idempotency_key,
    transaction_uuid: payment.transaction_uuid,
    recorded_at: payment.created_at,
    verified_at: payment.verified_at,
    recorded_by: payment.recorded_by,
  };
}

/**
 * Gets a payment by ID.
 */
export async function getPaymentById(actor: StaffActor, paymentId: string): Promise<PaymentDetail> {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      bill: {
        select: {
          outlet: {
            select: {
              organization_id: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new AppError('NOT_FOUND', 'Payment not found', 404);
  }

  // Check tenant isolation
  if (payment.bill.outlet.organization_id !== actor.organization_id) {
    throw new AppError('NOT_FOUND', 'Payment not found', 404);
  }

  // Check if user has access to this outlet
  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);
  if (!organizationWide && !outletIds.includes(payment.outlet_id)) {
    throw new AppError('FORBIDDEN', 'No access to this payment', 403);
  }

  return {
    id: payment.id,
    outlet_id: payment.outlet_id,
    bill_id: payment.bill_id,
    method: payment.method,
    status: payment.status,
    amount: formatDecimal(payment.amount),
    provider_ref: payment.provider_ref,
    idempotency_key: payment.idempotency_key,
    transaction_uuid: payment.transaction_uuid,
    recorded_at: payment.created_at,
    verified_at: payment.verified_at,
    recorded_by: payment.recorded_by,
  };
}

/**
 * Lists payments with filters.
 */
export async function listPayments(
  actor: StaffActor,
  filters: {
    page: number;
    limit: number;
    status?: string;
    method?: string;
    outlet_id?: string;
    bill_id?: string;
    date_from?: Date;
    date_to?: Date;
  },
) {
  if (!actor.organization_id) {
    throw new AppError('FORBIDDEN', 'User must belong to an organization', 403);
  }

  const { organizationWide, outletIds } = await getAccessibleOutletIds(actor);

  const where: Prisma.PaymentWhereInput = organizationWide
    ? { bill: { outlet: { organization_id: actor.organization_id } } }
    : { outlet_id: { in: outletIds } };

  if (filters.status) {
    where.status = filters.status as 'pending' | 'succeeded' | 'failed' | 'refunded';
  }

  if (filters.method) {
    where.method = filters.method as 'cash' | 'card' | 'online';
  }

  if (filters.outlet_id) {
    if (!organizationWide && !outletIds.includes(filters.outlet_id)) {
      throw new AppError('FORBIDDEN', 'No access to this outlet', 403);
    }
    where.outlet_id = filters.outlet_id;
  }

  if (filters.bill_id) {
    where.bill_id = filters.bill_id;
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

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        bill: {
          select: {
            invoice_number: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments: payments.map((payment) => ({
      id: payment.id,
      outlet_id: payment.outlet_id,
      bill_id: payment.bill_id,
      invoice_number: payment.bill?.invoice_number ?? null,
      method: payment.method,
      status: payment.status,
      amount: formatDecimal(payment.amount),
      provider_ref: payment.provider_ref,
      idempotency_key: payment.idempotency_key,
      transaction_uuid: payment.transaction_uuid,
      recorded_at: payment.created_at,
      verified_at: payment.verified_at,
      recorded_by: payment.recorded_by,
    })),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}