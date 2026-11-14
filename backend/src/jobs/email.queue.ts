import { Queue, Worker } from 'bullmq';

import { sendEmail } from '@/lib/email';

export const EMAIL_QUEUE_NAME = 'email';

let emailQueueInstance: Queue | null = null;
let emailWorkerInstance: Worker | null = null;

const isTest = process.env.NODE_ENV === 'test';

export function getEmailQueue(): Queue {
  if (isTest) {
    throw new Error('Email queue not available in test environment');
  }
  if (!emailQueueInstance) {
    emailQueueInstance = new Queue('email', {
      connection: {
        host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
        port: parseInt(
          new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379',
          10,
        ),
        password: new URL(process.env.REDIS_URL || 'redis://localhost:6379').password || '',
        maxRetriesPerRequest: 3,
      },
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
  return emailQueueInstance;
}

export function getEmailWorker(): Worker {
  if (isTest) {
    throw new Error('Email worker not available in test environment');
  }
  if (!emailWorkerInstance) {
    emailWorkerInstance = new Worker(
      'email',
      async (job) => {
        const { to, subject, html } = job.data as { to: string; subject: string; html: string };
        await sendEmail(to, subject, html);
      },
      {
        connection: {
          host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
          port: parseInt(
            new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379',
            10,
          ),
          password: new URL(process.env.REDIS_URL || 'redis://localhost:6379').password || '',
          maxRetriesPerRequest: 3,
        },
        concurrency: 5,
      },
    );

    emailWorkerInstance.on('failed', (job, err) => {
      console.error(`Email job ${job?.id} failed:`, err);
    });

    emailWorkerInstance.on('completed', (job) => {
      console.log(`Email job ${job.id} completed`);
    });
  }
  return emailWorkerInstance;
}

// For backward compatibility - these getters will lazily initialize
export const emailQueue = {
  get add() {
    return getEmailQueue().add.bind(getEmailQueue());
  },
  get close() {
    return getEmailQueue().close.bind(getEmailQueue());
  },
  get on() {
    return getEmailQueue().on.bind(getEmailQueue());
  },
};

export const emailWorker = {
  get close() {
    return getEmailWorker().close.bind(getEmailWorker());
  },
  get on() {
    return getEmailWorker().on.bind(getEmailWorker());
  },
  get waitUntilReady() {
    return getEmailWorker().waitUntilReady.bind(getEmailWorker());
  },
};
