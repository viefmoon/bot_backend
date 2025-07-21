import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../common/config/envValidator';
import { redisKeys } from '../common/constants';
import logger from '../common/utils/logger';
import { processMessageJob } from '../workers/messageWorker';
import { WhatsAppMessageJob } from './types';
import { redisService } from '../services/redis/RedisService';
import { prisma } from '../server';
import { SyncMetadataService } from '../services/sync/SyncMetadataService';

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
  const lockKey = redisKeys.userLock(userId);
  
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
  const lockKey = redisKeys.userLock(userId);
  
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
      const runId = job.id!; // Use BullMQ job ID as our unique run ID
      const currentRunKey = redisKeys.currentRun(userId);
      const latestMessageTimestampKey = redisKeys.latestMessageTimestamp(userId);
      
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
        
        // =================================================================
        // PASO 1: GUARDAR EL MENSAJE DEL USUARIO INMEDIATAMENTE
        // Esto se hace ANTES de cualquier verificación de cancelación.
        // =================================================================
        const messageContent = job.data.text?.body || '[Mensaje no textual]';
        const customer = await prisma.customer.findUnique({ where: { whatsappPhoneNumber: userId } });

        if (customer) {
          // Obtenemos los historiales existentes
          const fullHistory = Array.isArray(customer.fullChatHistory) ? customer.fullChatHistory : [];
          const relevantHistory = Array.isArray(customer.relevantChatHistory) ? customer.relevantChatHistory : [];

          const userMessageEntry = {
            role: 'user',
            content: messageContent,
            timestamp: new Date().toISOString()
          };

          // Agregamos el nuevo mensaje
          fullHistory.push(userMessageEntry);
          relevantHistory.push(userMessageEntry);

          // Actualizamos en la base de datos
          await prisma.customer.update({
            where: { id: customer.id },
            data: {
              fullChatHistory: fullHistory as any, // Prisma espera JsonValue
              relevantChatHistory: relevantHistory.slice(-20) as any, // Mantenemos el límite de 20
              lastInteraction: new Date()
            }
          });

          // Marcar para sincronización
          await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
          logger.info(`[History] User message from job ${runId} saved for user ${userId}.`);
        } else {
          logger.warn(`[History] Could not save message for job ${runId}. Customer ${userId} not found.`);
        }
        
        // =================================================================
        // PASO 2: VERIFICACIÓN DE CANCELACIÓN (AHORA ES SEGURO HACERLO)
        // Si se cancela, la RESPUESTA se aborta, pero el mensaje del usuario ya está guardado.
        // =================================================================
        // PRE-PROCESS CANCELLATION CHECK (for queued jobs)
        logger.info(`[DEBUG Pre-Process] Checking cancellation for job ${runId} from ${userId}`);
        logger.info(`[DEBUG Pre-Process] Current message timestamp: ${job.data.timestamp}, serverTimestamp: ${job.data.serverTimestamp || 'N/A'}`);
        
        try {
          const latestCombinedStr = await redisService.get(latestMessageTimestampKey);
          logger.info(`[DEBUG Pre-Process] Latest combined timestamp from Redis: ${latestCombinedStr || 'NULL'}`);
          
          if (latestCombinedStr) {
            // Parse combined timestamp format: "whatsappTimestamp:serverTimestamp"
            const [latestWAStr, latestServerStr] = latestCombinedStr.split(':');
            const latestWATimestamp = parseInt(latestWAStr, 10);
            const latestServerTimestamp = latestServerStr ? parseInt(latestServerStr, 10) : 0;
            
            const currentWATimestamp = parseInt(job.data.timestamp, 10);
            const currentServerTimestamp = job.data.serverTimestamp || 0;
            
            logger.info(`[DEBUG Pre-Process] Comparing WA timestamps: current ${currentWATimestamp} vs latest ${latestWATimestamp}`);
            
            // First compare WhatsApp timestamps
            if (currentWATimestamp < latestWATimestamp) {
              logger.info(`[DEBUG Pre-Process] CANCELLING: WA timestamp ${currentWATimestamp} < ${latestWATimestamp}`);
              logger.info(`[Cancelled Pre-Process] Job ${runId} is obsolete. Aborting RESPONSE generation.`);
              return;
            } else if (currentWATimestamp === latestWATimestamp && currentServerTimestamp && latestServerTimestamp) {
              // If WhatsApp timestamps are equal, compare server timestamps
              logger.info(`[DEBUG Pre-Process] WA timestamps equal, comparing server: current ${currentServerTimestamp} vs latest ${latestServerTimestamp}`);
              if (currentServerTimestamp < latestServerTimestamp) {
                logger.info(`[DEBUG Pre-Process] CANCELLING: Server timestamp ${currentServerTimestamp} < ${latestServerTimestamp}`);
                logger.info(`[Cancelled Pre-Process] Job ${runId} is obsolete (same second). Aborting RESPONSE generation.`);
                return;
              }
            }
          }
        } catch (error) {
          logger.warn(`[Pre-Process Check] Failed to check latest timestamp for ${userId}. Redis may be unavailable. Proceeding anyway.`, error);
          // Continue processing if Redis fails
        }
        
        // Set the "I'm the active job" flag
        try {
          await redisService.set(currentRunKey, runId, 300); // 5 minutes TTL
          logger.debug(`[Set Run ID] Job ${runId} is now the active run for user ${userId}`);
        } catch (error) {
          logger.warn(`[Set Run ID] Failed to set active run for ${userId}. Redis may be unavailable.`, error);
          // Continue processing even if we can't set the run ID
        }
        
        logger.info(`Processing job ${runId} for user ${userId}`);
        
        // Process the message with runId
        await processMessageJob(job.data, runId);
        
        // Small delay to ensure BullMQ completes its internal operations
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } finally {
        if (lockAcquired) {
          // Optional: Clean up the run flag if our job was the last to execute
          const finalRunId = await redisService.get(currentRunKey);
          if (finalRunId === runId) {
            await redisService.del(currentRunKey);
          }
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