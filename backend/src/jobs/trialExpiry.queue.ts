import { Queue, Worker } from 'bullmq';

import { prisma } from '@/lib/prisma';
import { emailService } from '@/services/email/email.service';

export const TRIAL_EXPIRY_QUEUE_NAME = 'trial-expiry';

let trialExpiryQueueInstance: Queue | null = null;
let trialExpiryWorkerInstance: Worker | null = null;

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

export function getTrialExpiryQueue(): Queue {
  if (isTest) {
    throw new Error('Trial expiry queue not available in test environment');
  }
  if (!trialExpiryQueueInstance) {
    trialExpiryQueueInstance = new Queue(TRIAL_EXPIRY_QUEUE_NAME, {
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
  return trialExpiryQueueInstance;
}

export function getTrialExpiryWorker(): Worker {
  if (isTest) {
    throw new Error('Trial expiry worker not available in test environment');
  }
  if (!trialExpiryWorkerInstance) {
    trialExpiryWorkerInstance = new Worker(
      TRIAL_EXPIRY_QUEUE_NAME,
      async (job) => {
        const { type } = job.data as { type: 'trial-expiry-check' };
        if (type === 'trial-expiry-check') {
          await processTrialExpiry();
        }
      },
      {
        connection: getRedisConnection(),
        concurrency: 1,
      },
    );

    trialExpiryWorkerInstance.on('failed', (job, err) => {
      console.error(`Trial expiry job ${job?.id} failed:`, err);
    });

    trialExpiryWorkerInstance.on('completed', (job) => {
      console.log(`Trial expiry job ${job.id} completed`);
    });
  }
  return trialExpiryWorkerInstance;
}

/**
 * Main trial expiry processing logic.
 * Runs daily to:
 * 1. Send reminder emails (3 days and 1 day before trial ends)
 * 2. Move expired trials (trialing -> grace)
 * 3. Move expired grace periods (grace -> suspended)
 * 4. Send trial expired and suspended notifications
 */
export async function processTrialExpiry(): Promise<void> {
  console.log('[TrialExpiry] Starting trial expiry processing...');

  // 1. Send reminder emails: 3 days and 1 day before trial ends
  await sendReminderEmails();

  // 2. Move expired trials (trialing -> grace)
  await moveExpiredTrialsToGrace();

  // 3. Move expired grace periods (grace -> suspended)
  await moveExpiredGraceToSuspended();

  console.log('[TrialExpiry] Trial expiry processing completed.');
}

/**
 * Sends reminder emails 3 days and 1 day before trial ends.
 */
export async function sendReminderEmails(): Promise<void> {
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const oneDayFromNow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'trialing',
      trial_ends_at: {
        gte: oneDayFromNow,
        lte: threeDaysFromNow,
      },
    },
    include: {
      organization: {
        include: {
          users: {
            where: {
              staffAssignments: { some: { role: { code: 'owner' } } },
            },
            take: 1,
          },
        },
      },
    },
  });

  for (const sub of subscriptions) {
    const owner = sub.organization.users[0];
    if (!owner?.email) continue;

    const daysUntilExpiry = Math.ceil(
      (sub.trial_ends_at!.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );

    if (daysUntilExpiry === 3 || daysUntilExpiry === 1) {
      try {
        await emailService.sendTrialExpiryReminder(
          owner.email,
          sub.organization.name,
          daysUntilExpiry,
          sub.trial_ends_at!,
        );
        console.log(
          `[TrialExpiry] Sent ${daysUntilExpiry}-day reminder to ${owner.email} for ${sub.organization.name}`,
        );
      } catch (err) {
        console.error(`[TrialExpiry] Failed to send reminder to ${owner.email}:`, err);
      }
    }
  }
}

/**
 * Moves expired trials (trialing) to grace period.
 */
export async function moveExpiredTrialsToGrace(): Promise<void> {
  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: 'trialing',
      trial_ends_at: { lt: new Date() },
    },
    include: {
      organization: {
        include: {
          users: {
            where: {
              staffAssignments: { some: { role: { code: 'owner' } } },
            },
            take: 1,
          },
        },
      },
    },
  });

  for (const sub of expiredTrials) {
    await prisma.$transaction(async (tx) => {
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'grace', grace_ends_at: graceEndsAt },
      });

      const owner = sub.organization.users[0];
      if (owner?.email) {
        try {
          await emailService.sendTrialExpired(owner.email, sub.organization.name);
          console.log(
            `[TrialExpiry] Sent trial expired notification to ${owner.email} for ${sub.organization.name}`,
          );
        } catch (err) {
          console.error(`[TrialExpiry] Failed to send trial expired to ${owner.email}:`, err);
        }
      }
    });

    console.log(`[TrialExpiry] Moved ${expiredTrials.length} trial(s) to grace period`);
  }
}

/**
 * Moves expired grace periods to suspended.
 */
export async function moveExpiredGraceToSuspended(): Promise<void> {
  const expiredGrace = await prisma.subscription.findMany({
    where: {
      status: 'grace',
      grace_ends_at: { lt: new Date() },
    },
    include: {
      organization: {
        include: {
          users: {
            where: {
              staffAssignments: { some: { role: { code: 'owner' } } },
            },
            take: 1,
          },
        },
      },
    },
  });

  for (const sub of expiredGrace) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'suspended' },
      });

      const owner = sub.organization.users[0];
      if (owner?.email) {
        try {
          await emailService.sendTrialSuspended(owner.email, sub.organization.name);
          console.log(
            `[TrialExpiry] Sent suspension notification to ${owner.email} for ${sub.organization.name}`,
          );
        } catch (err) {
          console.error(`[TrialExpiry] Failed to send suspension to ${owner.email}:`, err);
        }
      }
    });

    console.log(`[TrialExpiry] Suspended ${expiredGrace.length} organization(s)`);
  }
}

/**
 * Schedules the daily trial-expiry job.
 * Runs every day at 01:00 AM UTC.
 */
export async function scheduleTrialExpiryJob(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;

  const queue = getTrialExpiryQueue();

  // Remove existing scheduled jobs for this queue
  await queue.drain();

  // Add a repeating job that runs daily at 01:00 UTC
  await queue.add(
    'trial-expiry-check',
    { type: 'trial-expiry-check' },
    {
      repeat: { pattern: '0 1 * * *' }, // Daily at 01:00 UTC
      jobId: 'daily-trial-expiry-check',
    },
  );

  console.log('[TrialExpiry] Scheduled daily trial-expiry job at 01:00 UTC');
}

// Export lazy getters for backward compatibility
export const trialExpiryQueue = {
  get add() {
    return getTrialExpiryQueue().add.bind(getTrialExpiryQueue());
  },
  get close() {
    return getTrialExpiryQueue().close.bind(getTrialExpiryQueue());
  },
};

export const trialExpiryWorker = {
  get close() {
    return getTrialExpiryWorker().close.bind(getTrialExpiryWorker());
  },
  get on() {
    return getTrialExpiryWorker().on.bind(getTrialExpiryWorker());
  },
  get waitUntilReady() {
    return getTrialExpiryWorker().waitUntilReady.bind(getTrialExpiryWorker());
  },
};
