import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../common/config/envValidator';
import logger from '../common/utils/logger';
import { processMessageJob } from '../workers/messageWorker';
import { WhatsAppMessageJob } from './types';

// Redis connection configuration
const connection = {
  host: env.REDIS_HOST || 'localhost',
  port: parseInt(env.REDIS_PORT || '6380', 10),
  password: env.REDIS_PASSWORD,
};

// Create a dedicated Redis client for locking
const redisClient = new IORedis(connection);

// Single queue for all WhatsApp messages
export const messageQueue = new Queue<WhatsAppMessageJob>('whatsapp-messages', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600, count: 5000 },
  },
});

logger.info('BullMQ Message Queue initialized');

// Single worker instance that handles all jobs
let messageWorker: Worker<WhatsAppMessageJob> | null = null;

// Acquire a distributed lock for a user
async function acquireUserLock(userId: string, timeoutSeconds: number = 60): Promise<boolean> {
  const lockKey = `user-lock:${userId}`;
  
  try {
    // SET key value NX EX seconds
    // NX: Only set if key doesn't exist
    // EX: Set expiry in seconds to prevent permanent locks
    const result = await redisClient.set(lockKey, 'processing', 'EX', timeoutSeconds, 'NX');
    return result === 'OK';
  } catch (error) {
    logger.error(`Failed to acquire lock for user ${userId}:`, error);
    return false;
  }
}

// Release the distributed lock for a user
async function releaseUserLock(userId: string): Promise<void> {
  const lockKey = `user-lock:${userId}`;
  
  try {
    await redisClient.del(lockKey);
  } catch (error) {
    logger.error(`Failed to release lock for user ${userId}:`, error);
  }
}

export function startMessageWorker(): void {
  if (messageWorker) {
    logger.warn('Message worker already started');
    return;
  }

  const workerConcurrency = parseInt(env.BULLMQ_WORKER_CONCURRENCY || '5', 10);
  logger.info(`Starting BullMQ worker with concurrency: ${workerConcurrency}`);

  messageWorker = new Worker<WhatsAppMessageJob>(
    'whatsapp-messages',
    async (job: Job<WhatsAppMessageJob>) => {
      const userId = job.data.from;
      let lockAcquired = false;
      
      try {
        // Try to acquire lock with exponential backoff
        let attempts = 0;
        const maxAttempts = 100; // 100 * 150ms = 15 seconds max wait
        
        while (attempts < maxAttempts) {
          lockAcquired = await acquireUserLock(userId, 300); // 5 minute timeout
          
          if (lockAcquired) {
            logger.debug(`Lock acquired for user ${userId} on attempt ${attempts + 1}`);
            break;
          }
          
          // Exponential backoff: 100ms, 200ms, 400ms... up to 2 seconds
          const delay = Math.min(100 * Math.pow(2, Math.floor(attempts / 10)), 2000);
          await new Promise(resolve => setTimeout(resolve, delay));
          attempts++;
        }
        
        if (!lockAcquired) {
          throw new Error(`Failed to acquire lock for user ${userId} after ${maxAttempts} attempts`);
        }
        
        logger.info(`Processing job ${job.id} for user ${userId}`);
        
        // Process the message
        await processMessageJob(job.data);
        
        // Small delay to ensure BullMQ completes its internal operations
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } finally {
        // Always release the lock if we acquired it
        if (lockAcquired) {
          await releaseUserLock(userId);
          logger.debug(`Lock released for user ${userId}`);
        }
      }
    },
    { 
      connection, 
      concurrency: workerConcurrency,
      lockDuration: 60000, // Increase default lock duration to 60 seconds
      lockRenewTime: 20000, // Renew lock every 20 seconds
    }
  );

  // Event handlers
  messageWorker.on('completed', (job: Job<WhatsAppMessageJob>) => {
    logger.info(`Job ${job.id} for user ${job.data.from} completed successfully`);
  });

  messageWorker.on('failed', (job: Job<WhatsAppMessageJob> | undefined, err: Error) => {
    if (job) {
      logger.error(`Job ${job.id} for user ${job.data.from} failed:`, {
        error: err.message,
        stack: err.stack,
        attempts: job.attemptsMade,
      });
    } else {
      logger.error('A job failed:', { error: err.message });
    }
  });

  messageWorker.on('error', (err: Error) => {
    logger.error('Worker error:', { error: err.message, stack: err.stack });
  });

  logger.info('BullMQ Message Worker started and listening for jobs');
}

export async function stopMessageWorker(): Promise<void> {
  if (messageWorker) {
    await messageWorker.close();
    messageWorker = null;
    
    // Close Redis client
    redisClient.disconnect();
    
    logger.info('Message worker stopped');
  }
}