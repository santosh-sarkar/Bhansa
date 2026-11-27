import { createApp } from '@/app';
import { env } from '@/config/env';
import { connectRedis, disconnectRedis } from '@/lib/redis';
import { initializeSocketServer } from '@/lib/socket';
import { emailWorker } from '@/jobs/email.queue';
import { trialExpiryWorker, scheduleTrialExpiryJob } from '@/jobs/trialExpiry.queue';
import { lowStockAlertWorker, scheduleLowStockAlertJob } from '@/jobs/lowStockAlert.queue';
import { esewaReconcileWorker, scheduleEsewaReconcileJob } from '@/jobs/esewaReconcile.queue';
import { registerPaths } from '@/swagger';
import { logger } from '@/lib/logger';

async function start(): Promise<void> {
  // Register all OpenAPI paths with the registry
  registerPaths();

  await connectRedis();
  logger.info('Redis connected');

  // Ensure email worker is ready
  await emailWorker.waitUntilReady();
  logger.info('Email worker ready');

  // Ensure trial expiry worker is ready and scheduled
  await trialExpiryWorker.waitUntilReady();
  await scheduleTrialExpiryJob();
  logger.info('Trial expiry worker ready and scheduled');

  // Ensure low-stock alert worker is ready and scheduled
  await lowStockAlertWorker.waitUntilReady();
  await scheduleLowStockAlertJob();
  logger.info('Low-stock alert worker ready and scheduled');

  // Ensure eSewa reconcile worker is ready and scheduled
  await esewaReconcileWorker.waitUntilReady();
  await scheduleEsewaReconcileJob();
  logger.info('eSewa reconcile worker ready and scheduled');

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });

  // Initialize Socket.IO server
  const io = initializeSocketServer(server);
  logger.info('Socket.IO server attached');

  function shutdown(): void {
    logger.info('shutting down');
    void io.close(() => {
      logger.info('Socket.IO server closed');
    });
    server.close(() => {
      void (async () => {
        await emailWorker.close();
        await trialExpiryWorker.close();
        await lowStockAlertWorker.close();
        await esewaReconcileWorker.close();
        await disconnectRedis();
        logger.info(
          'HTTP server closed, email worker closed, trial expiry worker closed, low-stock alert worker closed, eSewa reconcile worker closed, Redis disconnected',
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
