import { createHmac } from 'node:crypto';
import type { Prisma } from '@prisma/client';

import { AppError } from '@/errors/AppError';
import { prisma } from '@/lib/prisma';
import { getDecryptedEsewaSecret } from '@/services/payment/esewa-settings.service';
import { generateSecureToken } from '@/utils/token';

export interface EsewaInitiateResult {
  payment_id: string;
  transaction_uuid: string;
  form_url: string;
  form_fields: Record<string, string>;
}

/**
 * Initiates eSewa payment for a bill.
 * Creates a pending payment record and returns signed form fields for eSewa redirect.
 * Based on eSewa v2 API specification.
 */
export async function initiateEsewaPayment(
  billId: string,
  returnUrl: string,
): Promise<EsewaInitiateResult> {
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

  // Check if bill is already paid
  if (bill.status === 'paid') {
    throw new AppError('VALIDATION_ERROR', 'Bill already paid', 400);
  }

  // Check if session has uncompleted orders
  if (bill.session && bill.session.orders.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Cannot initiate payment while session has uncompleted orders', 400);
  }

  // Get eSewa settings for the outlet
  const esewaSettings = await getDecryptedEsewaSecret(bill.outlet_id);
  if (!esewaSettings) {
    throw new AppError('VALIDATION_ERROR', 'eSewa not configured for this outlet', 400);
  }

  if (!esewaSettings.is_enabled) {
    throw new AppError('VALIDATION_ERROR', 'eSewa is disabled for this outlet', 400);
  }

  // Generate transaction UUID (eSewa requires unique transaction ID)
  const transactionUuid = generateSecureToken();

  // Generate idempotency key
  const idempotencyKey = `esewa-${transactionUuid}`;

  // Create pending payment record
  const payment = await prisma.payment.create({
    data: {
      outlet_id: bill.outlet_id,
      bill_id: bill.id,
      method: 'online',
      status: 'pending',
      amount: bill.total,
      transaction_uuid: transactionUuid,
      idempotency_key: idempotencyKey,
      provider_ref: null,
    },
  });

  // Prepare eSewa form fields according to eSewa v2 API
  // Reference: https://developer.esewa.com.np/
  const formFields = {
    // Required fields
    amount: bill.subtotal.toFixed(2),
    tax_amount: bill.tax_amount.toFixed(2),
    total_amount: bill.total.toFixed(2),
    transaction_uuid: transactionUuid,
    product_code: esewaSettings.product_code,
    product_service_charge: bill.service_charge.toFixed(2),
    product_delivery_charge: '0.00',
    success_url: returnUrl,
    failure_url: returnUrl,
    signed_field_names: '',
    signature: '',
  };

  // Calculate signature
  // eSewa v2 signature is HMAC-SHA256 of signed fields concatenated with comma
  // The signed_field_names field lists which fields are signed
  const signedFieldNames = [
    'amount',
    'tax_amount',
    'total_amount',
    'transaction_uuid',
    'product_code',
    'product_service_charge',
    'product_delivery_charge',
    'success_url',
    'failure_url',
  ].join(',');

  // Create signature string (field=value pairs joined by comma)
  const signatureString = signedFieldNames
    .split(',')
    .map((field) => `${field}=${formFields[field as keyof typeof formFields]}`)
    .join(',');

  const signature = createHmac('sha256', esewaSettings.secret_key)
    .update(signatureString)
    .digest('base64');

  // Update form fields with signature
  formFields.signed_field_names = signedFieldNames;
  formFields.signature = signature;

  // Determine eSewa form URL based on test mode
  const formUrl = esewaSettings.is_test_mode
    ? 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
    : 'https://epay.esewa.com.np/api/epay/main/v2/form';

  return {
    payment_id: payment.id,
    transaction_uuid: transactionUuid,
    form_url: formUrl,
    form_fields: formFields,
  };
}

/**
 * Verifies eSewa payment callback.
 * Checks signature and updates payment status.
 */
export async function verifyEsewaPayment(
  transactionUuid: string,
  callbackData: Record<string, string>,
): Promise<{
  payment_id: string;
  status: 'succeeded' | 'failed';
  amount: string;
}> {
  // Find payment by transaction UUID
  const payment = await prisma.payment.findUnique({
    where: { transaction_uuid: transactionUuid },
    include: {
      bill: {
        include: {
          outlet: true,
          session: {
            include: {
              table: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new AppError('NOT_FOUND', 'Payment not found', 404);
  }

  // Get eSewa settings for verification
  const esewaSettings = await getDecryptedEsewaSecret(payment.outlet_id);
  if (!esewaSettings) {
    throw new AppError('VALIDATION_ERROR', 'eSewa settings not found', 400);
  }

  // Verify signature from callback
  // eSewa sends back fields with a signature
  const { signature, signed_field_names, ...callbackFields } = callbackData;

  if (!signature || !signed_field_names) {
    throw new AppError('VALIDATION_ERROR', 'Missing signature or signed_field_names in callback', 400);
  }

  // Verify signature
  const signatureString = signed_field_names
    .split(',')
    .map((field) => `${field}=${callbackFields[field]}`)
    .join(',');

  const expectedSignature = createHmac('sha256', esewaSettings.secret_key)
    .update(signatureString)
    .digest('base64');

  if (signature !== expectedSignature) {
    throw new AppError('VALIDATION_ERROR', 'Invalid signature', 400);
  }

  // Check if amount matches
  const callbackAmount = parseFloat(callbackFields.total_amount || '0');
  const paymentAmount = Number(payment.amount);

  if (Math.abs(callbackAmount - paymentAmount) > 0.01) {
    throw new AppError('VALIDATION_ERROR', 'Amount mismatch', 400);
  }

  // Update payment status based on callback status
  const isSuccess = callbackFields.status === 'COMPLETE';

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: isSuccess ? 'succeeded' : 'failed',
        provider_ref: callbackFields.ref_id || null,
        raw_callback: callbackData,
        verified_at: new Date(),
      },
    });

    // If payment succeeded, update bill and close session
    if (isSuccess) {
      await tx.bill.update({
        where: { id: payment.bill_id },
        data: {
          status: 'paid',
          paid_at: new Date(),
        },
      });

      if (payment.bill.session_id) {
        // Mark all orders as completed
        await tx.order.updateMany({
          where: {
            session_id: payment.bill.session_id,
            status: { notIn: ['cancelled', 'completed'] },
          },
          data: { status: 'completed' },
        });

        // Close session
        await tx.tableSession.update({
          where: { id: payment.bill.session_id },
          data: { status: 'closed', closed_at: new Date() },
        });

        // Free table
        if (payment.bill.session?.table_id) {
          await tx.diningTable.update({
            where: { id: payment.bill.session.table_id },
            data: { status: 'free' },
          });
        }
      }
    }

    return updated;
  });

  return {
    payment_id: updatedPayment.id,
    status: isSuccess ? 'succeeded' : 'failed',
    amount: formatDecimal(updatedPayment.amount),
  };
}

function formatDecimal(d: Prisma.Decimal): string {
  return d.toFixed(2);
}