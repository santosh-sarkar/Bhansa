import { Queue, Worker } from 'bullmq';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getDecryptedEsewaSecret } from '@/services/payment/esewa-settings.service';
import { createHmac } from 'node:crypto';

export const ESEWA_RECONCILE_QUEUE_NAME = 'esewa-reconcile';

let esewaReconcileQueueInstance: Queue | null = null;
let esewaReconcileWorkerInstance: Worker | null = null;

const isTest = process.env.NODE_ENV === 'test';

function getRedisConnection() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || '',
    maxRetriesPerRequest: 3,
  };
}

export function getEsewaReconcileQueue(): Queue {
  if (isTest) {
    throw new Error('eSewa reconcile queue not available in test environment');
  }
  if (!esewaReconcileQueueInstance) {
    esewaReconcileQueueInstance = new Queue(ESEWA_RECONCILE_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return esewaReconcileQueueInstance;
}

export function getEsewaReconcileWorker(): Worker {
  if (isTest) {
    throw new Error('eSewa reconcile worker not available in test environment');
  }
  if (!esewaReconcileWorkerInstance) {
    esewaReconcileWorkerInstance = new Worker(
      ESEWA_RECONCILE_QUEUE_NAME,
      async (job) => {
        const { type } = job.data as { type: 'esewa-reconcile-check' };
        if (type === 'esewa-reconcile-check') {
          await processEsewaReconcile();
        }
      },
      {
        connection: getRedisConnection(),
        concurrency: 1,
      },
    );

    esewaReconcileWorkerInstance.on('failed', (job, err) => {
      console.error(`eSewa reconcile job ${job?.id} failed:`, err);
    });

    esewaReconcileWorkerInstance.on('completed', (job) => {
      console.log(`eSewa reconcile job ${job.id} completed`);
    });
  }
  return esewaReconcileWorkerInstance;
}

/**
 * Main eSewa reconciliation processing logic.
 * Runs periodically to:
 * 1. Find pending eSewa payments older than a threshold
 * 2. Call eSewa status check API for each
 * 3. Update payment status based on response
 * 4. Complete bill/session/table if payment succeeded
 */
export async function processEsewaReconcile(): Promise<void> {
  console.log('[EsewaReconcile] Starting eSewa payment reconciliation...');

  // Find pending eSewa payments older than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const pendingPayments = await prisma.payment.findMany({
    where: {
      method: 'online',
      status: 'pending',
      created_at: { lt: fiveMinutesAgo },
    },
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
    take: 50, // Process in batches
  });

  console.log(`[EsewaReconcile] Found ${pendingPayments.length} pending payments to reconcile`);

  let successCount = 0;
  let failedCount = 0;

  for (const payment of pendingPayments) {
    try {
      const result = await checkEsewaPaymentStatus(payment);
      if (result === 'succeeded') {
        successCount++;
      } else if (result === 'failed') {
        failedCount++;
      }
    } catch (err) {
      console.error(`[EsewaReconcile] Failed to reconcile payment ${payment.id}:`, err);
      failedCount++;
    }
  }

  console.log(`[EsewaReconcile] Reconciliation completed. Success: ${successCount}, Failed: ${failedCount}`);
}

interface PendingPayment {
  id: string;
  transaction_uuid: string | null;
  outlet_id: string;
  amount: Prisma.Decimal;
  bill: {
    id: string;
    session_id: string | null;
    session: {
      id: string;
      table_id: string | null;
      table: {
        id: string;
        status: string;
      } | null;
    } | null;
  };
}

/**
 * Checks eSewa payment status via eSewa status check API.
 * Reference: https://developer.esewa.com.np/
 */
async function checkEsewaPaymentStatus(payment: PendingPayment): Promise<'succeeded' | 'failed' | 'pending'> {
  const { transaction_uuid, outlet_id, bill, amount } = payment;

  if (!transaction_uuid) {
    console.error(`[EsewaReconcile] Payment ${payment.id} missing transaction_uuid`);
    return 'pending';
  }

  // Get eSewa settings for the outlet
  const esewaSettings = await getDecryptedEsewaSecret(outlet_id);
  if (!esewaSettings) {
    console.error(`[EsewaReconcile] No eSewa settings for outlet ${outlet_id}`);
    return 'pending';
  }

  if (!esewaSettings.is_enabled) {
    console.error(`[EsewaReconcile] eSewa disabled for outlet ${outlet_id}`);
    return 'pending';
  }

  // Determine status check URL based on test mode
  const statusUrl = esewaSettings.is_test_mode
    ? 'https://rc-epay.esewa.com.np/api/epay/main/v2/status'
    : 'https://epay.esewa.com.np/api/epay/main/v2/status';

  try {
    // Prepare request body for eSewa status check API
    // eSewa status check requires: product_code, transaction_uuid, total_amount, signature
    const requestBody = {
      product_code: esewaSettings.product_code,
      transaction_uuid: transaction_uuid,
      total_amount: amount.toFixed(2),
    } as Record<string, string>;

    // Create signature for status check request
    const signatureString = `product_code=${requestBody.product_code},transaction_uuid=${requestBody.transaction_uuid},total_amount=${requestBody.total_amount}`;
    const signature = createHmac('sha256', esewaSettings.secret_key)
      .update(signatureString)
      .digest('base64');

    requestBody.signature = signature;

    // Call eSewa status check API
    const response = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`[EsewaReconcile] eSewa status check failed with status ${response.status}`);
      return 'pending';
    }

    const result = await response.json() as {
      status: string;
      total_amount?: string;
      ref_id?: string;
      [key: string]: unknown;
    };

    // Process eSewa status check response
    // Expected response: { status: 'COMPLETE' | 'PENDING' | 'FAILED', ... }
    const status = result.status;

    if (status === 'COMPLETE') {
      // Verify amount matches
      const callbackAmount = parseFloat(result.total_amount || '0');
      const paymentAmount = Number(amount);

      if (Math.abs(callbackAmount - paymentAmount) > 0.01) {
        console.error(`[EsewaReconcile] Amount mismatch for ${transaction_uuid}`);
        return 'pending';
      }

      // Update payment to succeeded
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'succeeded',
            provider_ref: result.ref_id || null,
            raw_callback: result as Prisma.InputJsonValue,
            verified_at: new Date(),
          },
        });

        // Update bill and close session
        await tx.bill.update({
          where: { id: bill.id },
          data: {
            status: 'paid',
            paid_at: new Date(),
          },
        });

        if (bill.session_id) {
          await tx.order.updateMany({
            where: {
              session_id: bill.session_id,
              status: { notIn: ['cancelled', 'completed'] },
            },
            data: { status: 'completed' },
          });

          await tx.tableSession.update({
            where: { id: bill.session_id },
            data: { status: 'closed', closed_at: new Date() },
          });

          if (bill.session?.table_id) {
            await tx.diningTable.update({
              where: { id: bill.session.table_id },
              data: { status: 'free' },
            });
          }
        }
      });

      console.log(`[EsewaReconcile] Payment ${transaction_uuid} marked as succeeded`);
      return 'succeeded';
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      // Update payment to failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          raw_callback: result as Prisma.InputJsonValue,
          verified_at: new Date(),
        },
      });

      console.log(`[EsewaReconcile] Payment ${transaction_uuid} marked as failed`);
      return 'failed';
    } else {
      // Still pending
      return 'pending';
    }
  } catch (err) {
    console.error(`[EsewaReconcile] Error checking status for ${transaction_uuid}:`, err);
    return 'pending';
  }
}

/**
 * Schedules the eSewa reconciliation job.
 * Runs every 5 minutes to check pending payments.
 */
export async function scheduleEsewaReconcileJob(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;

  const queue = getEsewaReconcileQueue();

  // Remove existing scheduled jobs for this queue
  await queue.drain();

  // Add a repeating job that runs every 5 minutes
  await queue.add(
    'esewa-reconcile-check',
    { type: 'esewa-reconcile-check' },
    {
      repeat: { pattern: '*/5 * * * *' }, // Every 5 minutes
      jobId: 'esewa-reconcile-check',
    },
  );

  console.log('[EsewaReconcile] Scheduled eSewa reconcile job every 5 minutes');
}

// Export lazy getters for backward compatibility
export const esewaReconcileQueue = {
  get add() {
    return getEsewaReconcileQueue().add.bind(getEsewaReconcileQueue());
  },
  get close() {
    return getEsewaReconcileQueue().close.bind(getEsewaReconcileQueue());
  },
};

export const esewaReconcileWorker = {
  get close() {
    return getEsewaReconcileWorker().close.bind(getEsewaReconcileWorker());
  },
  get on() {
    return getEsewaReconcileWorker().on.bind(getEsewaReconcileWorker());
  },
  get waitUntilReady() {
    return getEsewaReconcileWorker().waitUntilReady.bind(getEsewaReconcileWorker());
  },
};