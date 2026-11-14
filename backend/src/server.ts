import { createApp } from '@/app';
import { env } from '@/config/env';
import { connectRedis, disconnectRedis } from '@/lib/redis';
import { emailWorker } from '@/jobs/email.queue';
import { trialExpiryWorker, scheduleTrialExpiryJob } from '@/jobs/trialExpiry.queue';
import { logger } from '@/lib/logger';

async function start(): Promise<void> {
  await connectRedis();
  logger.info('Redis connected');

  // Ensure email worker is ready
  await emailWorker.waitUntilReady();
  logger.info('Email worker ready');

  // Ensure trial expiry worker is ready and scheduled
  await trialExpiryWorker.waitUntilReady();
  await scheduleTrialExpiryJob();
  logger.info('Trial expiry worker ready and scheduled');

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });

  function shutdown(): void {
    logger.info('shutting down');
    server.close(() => {
      void (async () => {
        await emailWorker.close();
        await trialExpiryWorker.close();
        await disconnectRedis();
        logger.info(
          'HTTP server closed, email worker closed, trial expiry worker closed, Redis disconnected',
        );
        process.exit(0);
      })();
    });

    setTimeout(() => {
      logger.error('forced shutdown');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err: unknown) => {
  logger.error({ err }, 'failed to start');
  process.exit(1);
});
