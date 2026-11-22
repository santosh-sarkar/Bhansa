import type { Prisma } from '@prisma/client';
import { Queue, Worker } from 'bullmq';

import { prisma } from '@/lib/prisma';
import { emailService } from '@/services/email/email.service';
import { getIO } from '@/lib/socket';
import { emitToOutletManagers } from '@/lib/socket';

export const LOW_STOCK_ALERT_QUEUE_NAME = 'low-stock-alert';

let lowStockAlertQueueInstance: Queue | null = null;
let lowStockAlertWorkerInstance: Worker | null = null;

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

export function getLowStockAlertQueue(): Queue {
  if (isTest) {
    throw new Error('Low stock alert queue not available in test environment');
  }
  if (!lowStockAlertQueueInstance) {
    lowStockAlertQueueInstance = new Queue(LOW_STOCK_ALERT_QUEUE_NAME, {
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
  return lowStockAlertQueueInstance;
}

export function getLowStockAlertWorker(): Worker {
  if (isTest) {
    throw new Error('Low stock alert worker not available in test environment');
  }
  if (!lowStockAlertWorkerInstance) {
    lowStockAlertWorkerInstance = new Worker(
      LOW_STOCK_ALERT_QUEUE_NAME,
      async (job) => {
        const { type } = job.data as { type: 'low-stock-check' };
        if (type === 'low-stock-check') {
          await processLowStockAlerts();
        }
      },
      {
        connection: getRedisConnection(),
        concurrency: 1,
      },
    );

    lowStockAlertWorkerInstance.on('failed', (job, err) => {
      console.error(`Low stock alert job ${job?.id} failed:`, err);
    });

    lowStockAlertWorkerInstance.on('completed', (job) => {
      console.log(`Low stock alert job ${job.id} completed`);
    });
  }
  return lowStockAlertWorkerInstance;
}

/**
 * Main low-stock alert processing logic.
 * Runs periodically to:
 * 1. Find all outlet stock items below their low_threshold
 * 2. Group alerts by organization and outlet
 * 3. Send email notifications to owners/managers
 * 4. Emit socket events for real-time UI updates
 * 5. Use de-duplication to avoid spamming (only alert once per ingredient per outlet per threshold breach)
 */
export async function processLowStockAlerts(): Promise<void> {
  console.log('[LowStockAlert] Starting low-stock alert processing...');

  // Find all outlet stock items where quantity <= low_threshold AND low_threshold > 0
  // Using $queryRaw since Prisma doesn't support field-to-field comparison in where clause
  const lowStockItems = await prisma.$queryRaw<
    Array<{
      outlet_id: string;
      ingredient_id: string;
      quantity: Prisma.Decimal;
      low_threshold: Prisma.Decimal;
      updated_at: Date;
      ingredient_name: string;
      ingredient_unit: string;
      outlet_name: string;
      outlet_organization_id: string;
    }>
  >`
    SELECT 
      os.outlet_id,
      os.ingredient_id,
      os.quantity,
      os.low_threshold,
      os.updated_at,
      i.name as ingredient_name,
      i.unit as ingredient_unit,
      o.name as outlet_name,
      o.organization_id as outlet_organization_id
    FROM "outlet_stock" os
    JOIN "ingredients" i ON i.id = os.ingredient_id
    JOIN "outlets" o ON o.id = os.outlet_id
    WHERE os.low_threshold > 0
    AND os.quantity <= os.low_threshold
    AND o.deleted_at IS NULL
  `;

  if (lowStockItems.length === 0) {
    console.log('[LowStockAlert] No low-stock items found.');
    return;
  }

  console.log(`[LowStockAlert] Found ${lowStockItems.length} low-stock items.`);

  // Group by organization -> outlet
  const orgOutletMap = new Map<string, Map<string, LowStockAlertItem[]>>();

  // Get organization names and user emails
  const orgIds = [...new Set(lowStockItems.map((item) => item.outlet_organization_id))];
  const organizations = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgNameMap = new Map(organizations.map((o) => [o.id, o.name]));

  for (const stock of lowStockItems) {
    const orgId = stock.outlet_organization_id;
    const outletId = stock.outlet_id;

    if (!orgOutletMap.has(orgId)) {
      orgOutletMap.set(orgId, new Map());
    }
    const outletMap = orgOutletMap.get(orgId)!;

    if (!outletMap.has(outletId)) {
      outletMap.set(outletId, []);
    }
    outletMap.get(outletId)!.push({
      item: stock,
      orgName: orgNameMap.get(orgId) || 'Unknown',
    });
  }

  // Process each organization
  for (const [orgId, outletMap] of orgOutletMap) {
    const orgName = orgNameMap.get(orgId) || 'Unknown';

    // Get owner/manager emails for this organization
    const staff = await prisma.user.findMany({
      where: {
        organization_id: orgId,
        staffAssignments: {
          some: {
            role: { code: { in: ['owner', 'manager'] } },
          },
        },
      },
      select: { email: true, id: true },
      distinct: ['email'],
    });

    const recipientEmails = staff.map((s) => s.email).filter(Boolean);

    if (recipientEmails.length === 0) {
      console.log(
        `[LowStockAlert] No owner/manager emails for organization ${orgName}, skipping email.`,
      );
      continue;
    }

    // Process each outlet
    for (const [outletId, items] of outletMap) {
      // items is guaranteed to have at least one element since we only create entries with items
      const outletName = items[0]!.item.outlet_name;

      // De-duplication: Check if we've already alerted for these items recently
      // We'll use a simple approach: track last alert time in a Redis key or DB
      // For now, we'll check if there's a recent alert (within 24 hours) using a simple in-memory approach
      // In production, this should use Redis with TTL

      // Filter items that haven't been alerted recently
      const newAlerts = filterNewAlerts(orgId, outletId, items);

      if (newAlerts.length === 0) {
        console.log(
          `[LowStockAlert] All low-stock items for outlet ${outletName} already alerted recently.`,
        );
        continue;
      }

      // Send email
      for (const email of recipientEmails) {
        try {
          const alerts = newAlerts.map((alert) => ({
            ingredientName: alert.item.ingredient_name,
            currentStock: Number(alert.item.quantity),
            threshold: Number(alert.item.low_threshold),
            unit: alert.item.ingredient_unit,
          }));
          await emailService.sendLowStockAlert(email, orgName, outletName, alerts);
          console.log(`[LowStockAlert] Queued low-stock email to ${email} for ${outletName}`);
        } catch (err) {
          console.error(`[LowStockAlert] Failed to queue email to ${email}:`, err);
        }
      }

      // Emit socket event for real-time UI
      const io = getIO();
      if (io) {
        for (const alert of newAlerts) {
          emitToOutletManagers(io, outletId, 'stock:low', {
            ingredientId: alert.item.ingredient_id,
            name: alert.item.ingredient_name,
            currentStock: Number(alert.item.quantity),
            threshold: Number(alert.item.low_threshold),
            outletId,
            outletName,
          });
        }
      }

      // Record that we've alerted for these items (de-duplication)
      recordAlertSent(
        orgId,
        outletId,
        newAlerts.map((a) => a.item.ingredient_id),
      );
    }
  }

  console.log('[LowStockAlert] Low-stock alert processing completed.');
}

interface RawLowStockItem {
  outlet_id: string;
  ingredient_id: string;
  quantity: Prisma.Decimal;
  low_threshold: Prisma.Decimal;
  updated_at: Date;
  ingredient_name: string;
  ingredient_unit: string;
  outlet_name: string;
  outlet_organization_id: string;
}

interface LowStockAlertItem {
  item: RawLowStockItem;
  orgName: string;
}

/**
 * Filters out items that have been alerted recently (de-duplication).
 * Uses a simple in-memory cache with timestamps. In production, use Redis with TTL.
 */
const alertCache = new Map<string, number>(); // key: "orgId:outletId:ingredientId" -> timestamp

function filterNewAlerts(
  orgId: string,
  outletId: string,
  items: LowStockAlertItem[],
): LowStockAlertItem[] {
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  return items.filter(({ item }) => {
    const key = `${orgId}:${outletId}:${item.ingredient_id}`;
    const lastAlert = alertCache.get(key);
    if (!lastAlert || now - lastAlert > TWENTY_FOUR_HOURS) {
      return true;
    }
    return false;
  });
}

function recordAlertSent(orgId: string, outletId: string, ingredientIds: string[]): void {
  const now = Date.now();
  for (const ingredientId of ingredientIds) {
    const key = `${orgId}:${outletId}:${ingredientId}`;
    alertCache.set(key, now);
  }
}

/**
 * Schedules the low-stock alert job.
 * Runs every hour (can be adjusted).
 */
export async function scheduleLowStockAlertJob(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;

  const queue = getLowStockAlertQueue();

  // Remove existing scheduled jobs for this queue
  await queue.drain();

  // Add a repeating job that runs every hour at minute 0
  await queue.add(
    'low-stock-check',
    { type: 'low-stock-check' },
    {
      repeat: { pattern: '0 * * * *' }, // Every hour at minute 0
      jobId: 'hourly-low-stock-check',
    },
  );

  console.log('[LowStockAlert] Scheduled hourly low-stock alert job');
}

// Export lazy getters for backward compatibility
export const lowStockAlertQueue = {
  get add() {
    return getLowStockAlertQueue().add.bind(getLowStockAlertQueue());
  },
  get close() {
    return getLowStockAlertQueue().close.bind(getLowStockAlertQueue());
  },
};

export const lowStockAlertWorker = {
  get close() {
    return getLowStockAlertWorker().close.bind(getLowStockAlertWorker());
  },
  get on() {
    return getLowStockAlertWorker().on.bind(getLowStockAlertWorker());
  },
  get waitUntilReady() {
    return getLowStockAlertWorker().waitUntilReady.bind(getLowStockAlertWorker());
  },
};
