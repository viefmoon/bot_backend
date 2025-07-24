import { Queue, Worker, Job } from 'bullmq';
import logger from '../../common/utils/logger';
import { env } from '../../common/config/envValidator';
import { SyncNotificationService } from './SyncNotificationService';
import { prisma } from '../../lib/prisma';
import { SyncMetadataService } from './SyncMetadataService';

interface SyncRetryJobData {
  orderId: string;
  attemptNumber: number;
  maxAttempts: number;
}

export class SyncRetryService {
  private static queue: Queue<SyncRetryJobData>;
  private static worker: Worker<SyncRetryJobData>;
  private static readonly QUEUE_NAME = 'sync-retry';
  private static readonly MAX_RETRY_ATTEMPTS = 5;
  private static readonly RETRY_DELAY_MS = 60000; // 1 minute

  // Redis connection configuration
  private static readonly connection = {
    host: env.REDIS_HOST || 'localhost',
    port: parseInt(env.REDIS_PORT || '6380', 10),
    password: env.REDIS_PASSWORD,
  };

  static async initialize() {
    // Create queue
    this.queue = new Queue(this.QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 1, // We handle retries manually
      }
    });

    // Create worker
    this.worker = new Worker(
      this.QUEUE_NAME,
      async (job: Job<SyncRetryJobData>) => {
        await this.processRetry(job.data);
      },
      {
        connection: this.connection,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug(`Sync retry job ${job.id} completed for order ${job.data.orderId}`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Sync retry job ${job?.id} failed:`, err);
    });

    logger.info('Sync retry service initialized');
  }

  /**
   * Schedule a retry for an order if no clients are connected
   */
  static async scheduleRetryIfNeeded(orderId: string) {
    // Check if any client is connected
    if (SyncNotificationService.isAnyClientConnected()) {
      logger.debug(`Clients connected, no retry needed for order ${orderId}`);
      return;
    }

    // Check if order is still pending sync
    const isPending = await this.isOrderPendingSync(orderId);
    if (!isPending) {
      logger.debug(`Order ${orderId} no longer pending sync, skipping retry`);
      return;
    }

    // Schedule first retry attempt
    await this.scheduleRetry(orderId, 1);
    logger.info(`Scheduled sync retry for order ${orderId} - no clients connected`);
  }

  /**
   * Schedule a retry attempt
   */
  private static async scheduleRetry(orderId: string, attemptNumber: number) {
    const jobId = `sync-${orderId}-attempt-${attemptNumber}`;
    
    await this.queue.add(
      'retry-sync',
      {
        orderId,
        attemptNumber,
        maxAttempts: this.MAX_RETRY_ATTEMPTS
      },
      {
        jobId,
        delay: this.RETRY_DELAY_MS * attemptNumber, // Exponential backoff
      }
    );
  }

  /**
   * Process a retry attempt
   */
  private static async processRetry(data: SyncRetryJobData) {
    const { orderId, attemptNumber, maxAttempts } = data;
    
    logger.info(`Processing sync retry for order ${orderId} (attempt ${attemptNumber}/${maxAttempts})`);

    // Check if order is still pending sync
    const isPending = await this.isOrderPendingSync(orderId);
    if (!isPending) {
      logger.info(`Order ${orderId} already synced, stopping retries`);
      return;
    }

    // Check if any client is connected now
    if (SyncNotificationService.isAnyClientConnected()) {
      logger.info(`Clients now connected, retrying sync notification for order ${orderId}`);
      
      // Retry the notification
      await SyncNotificationService.notifyPendingChanges(orderId);
      
      // No need to schedule another retry if clients are connected
      return;
    }

    // Schedule next retry if not at max attempts
    if (attemptNumber < maxAttempts) {
      await this.scheduleRetry(orderId, attemptNumber + 1);
      logger.info(`Scheduled retry ${attemptNumber + 1}/${maxAttempts} for order ${orderId}`);
    } else {
      logger.warn(`Max retry attempts reached for order ${orderId}. Order will remain pending until a client connects.`);
    }
  }

  /**
   * Check if an order is still pending synchronization
   */
  private static async isOrderPendingSync(orderId: string): Promise<boolean> {
    const metadata = await prisma.syncMetadata.findFirst({
      where: {
        entityType: 'Order',
        entityId: orderId,
        syncPending: true
      }
    });

    return metadata !== null;
  }

  /**
   * Cancel all pending retries for an order (when it gets synced)
   */
  static async cancelRetries(orderId: string) {
    try {
      // Remove all retry jobs for this order
      for (let i = 1; i <= this.MAX_RETRY_ATTEMPTS; i++) {
        const jobId = `sync-${orderId}-attempt-${i}`;
        const job = await this.queue.getJob(jobId);
        if (job && ['waiting', 'delayed'].includes(await job.getState())) {
          await job.remove();
          logger.debug(`Cancelled retry job ${jobId}`);
        }
      }
    } catch (error) {
      logger.error('Error cancelling sync retries:', error);
    }
  }

  /**
   * Shutdown the service gracefully
   */
  static async shutdown() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    logger.info('Sync retry service shut down');
  }
}