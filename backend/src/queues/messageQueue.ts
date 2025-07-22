import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../common/config/envValidator';
import { redisKeys, CONTEXT_KEYS } from '../common/constants';
import logger from '../common/utils/logger';
import { WhatsAppMessageJob } from './types';
import { redisService } from '../services/redis/RedisService';
import { prisma } from '../server';
import { SyncMetadataService } from '../services/sync/SyncMetadataService';
import { MessageProcessor } from '../services/messaging/MessageProcessor';
import { MessageContext } from '../services/messaging/MessageContext';
import { sendWhatsAppMessage, sendWhatsAppInteractiveMessage, sendMessageWithUrlButton } from '../services/whatsapp';

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
      const latestMessageTimestampKey = redisKeys.latestMessageTimestamp(userId);
      
      // ==========================================================
      // ETAPA 1: ESCRITURA ATÓMICA Y RÁPIDA DEL MENSAJE DEL USUARIO
      // ==========================================================
      let customer: any;
      let fullHistory: any[] = [];
      let relevantHistory: any[] = [];
      let lockAcquired = false;
      
      try {
        // Try to acquire lock with exponential backoff
        let attempts = 0;
        const maxAttempts = 100; // 100 * 150ms = 15 seconds max wait
        
        while (attempts < maxAttempts) {
          lockAcquired = await acquireUserLock(userId, 10); // Short 10 second lock
          
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
        
        // OBTENER Y PREPARAR EL HISTORIAL DE FORMA ATÓMICA
        customer = await prisma.customer.findUnique({ where: { whatsappPhoneNumber: userId } });
        
        if (!customer) {
          // Crear nuevo cliente
          const newCustomer = await prisma.customer.create({
            data: {
              whatsappPhoneNumber: userId,
              lastInteraction: new Date(),
              fullChatHistory: [],
              relevantChatHistory: []
            }
          });
          await SyncMetadataService.markForSync('Customer', newCustomer.id, 'REMOTE');
          logger.info(`Created new customer for ${userId}`);
          
          // Para nuevos clientes, procesar con historiales vacíos
          const messageContent = job.data.text?.body || '[Mensaje no textual]';
          const userMessageEntry = {
            role: 'user',
            content: messageContent,
            timestamp: new Date(parseInt(job.data.timestamp, 10) * 1000).toISOString()
          };
          
          const fullHistory = [userMessageEntry];
          const relevantHistory = [userMessageEntry];
          
          // Procesar con el nuevo cliente
          await MessageProcessor.processWithPipeline(
            job.data,
            runId,
            newCustomer,
            fullHistory,
            relevantHistory
          );
          return;
        }

        // Cliente existente: obtener y actualizar historiales
        fullHistory = Array.isArray(customer.fullChatHistory) ? customer.fullChatHistory : [];
        relevantHistory = Array.isArray(customer.relevantChatHistory) ? customer.relevantChatHistory : [];


        // Añadir el mensaje actual
        const messageContent = job.data.text?.body || '[Mensaje no textual]';
        const userMessageEntry = {
          role: 'user',
          content: messageContent,
          timestamp: new Date(parseInt(job.data.timestamp, 10) * 1000).toISOString()
        };
        
        fullHistory.push(userMessageEntry);
        relevantHistory.push(userMessageEntry);

        // Ordenar para garantizar la cronología
        const sortHistory = (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        fullHistory.sort(sortHistory);
        relevantHistory.sort(sortHistory);
        relevantHistory = relevantHistory.slice(-30);
        
        // Guardar el historial actualizado CON el mensaje del usuario
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            fullChatHistory: fullHistory as any,
            relevantChatHistory: relevantHistory as any,
            lastInteraction: new Date()
          }
        });
        await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
        logger.info(`[History-Phase1] User message from job ${runId} saved for user ${userId}.`);
        
      } finally {
        if (lockAcquired) {
          await releaseUserLock(userId);
          logger.debug(`Lock released for user ${userId} - Phase 1 complete`);
        }
      }
      
      // ==========================================================
      // ETAPA 2: PROCESAMIENTO DE RESPUESTA (SIN BLOQUEO)
      // ==========================================================
      const isObsolete = await isJobObsolete(job, latestMessageTimestampKey);
      if (isObsolete) {
        logger.info(`[Cancelled] Job ${runId} is obsolete. Response generation aborted.`);
        return;
      }
      
      logger.info(`[Worker ${process.pid}] Processing job ${runId} for user ${userId} with AI`);
      
      const finalContext = await MessageProcessor.processWithPipeline(
        job.data,
        runId,
        customer,
        fullHistory,
        relevantHistory // Ya está limitado a 20
      );
        
      // ==========================================================
      // ETAPA 3: GUARDADO DE LA RESPUESTA DEL BOT (CON OTRO BLOQUEO)
      // ==========================================================
      const wasCancelled = await wasJobCancelled(job);
      const skipHistoryUpdate = finalContext.get(CONTEXT_KEYS.SKIP_HISTORY_UPDATE);
      
      if (skipHistoryUpdate) {
        logger.debug(`[History] Skipping history update - SKIP_HISTORY_UPDATE flag is set`);
      }
      
      if (!wasCancelled && !skipHistoryUpdate) {
        lockAcquired = false; // Reset for new lock
        
        try {
          // Acquire lock again for saving bot response
          lockAcquired = await acquireUserLock(userId, 10);
          if (!lockAcquired) {
            throw new Error(`Could not acquire lock for bot response on job ${runId}`);
          }
          
          // Re-read history in case it changed while AI was processing
          const latestCustomer = await prisma.customer.findUnique({ 
            where: { id: customer.id } 
          });
          
          let latestFullHistory = Array.isArray(latestCustomer?.fullChatHistory) 
            ? latestCustomer.fullChatHistory 
            : fullHistory;
          let latestRelevantHistory = Array.isArray(latestCustomer?.relevantChatHistory) 
            ? latestCustomer.relevantChatHistory 
            : relevantHistory;
          for (const response of finalContext.unifiedResponses || []) {
            const textContent = response.content?.text;
            const historyMarker = response.metadata?.historyMarker;
            const isRelevant = response.metadata?.isRelevant;

            if (textContent) {
              const assistantEntry = {
                role: 'assistant',
                content: textContent,
                timestamp: new Date().toISOString()
              };
              latestFullHistory.push(assistantEntry);

              if (historyMarker || isRelevant) {
                latestRelevantHistory.push({
                  ...assistantEntry,
                  content: historyMarker || textContent
                });
              }
            }
          }
          
          // Sort and limit
          const sortHistory = (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          latestFullHistory.sort(sortHistory);
          latestRelevantHistory.sort(sortHistory);
          latestRelevantHistory = latestRelevantHistory.slice(-30);
          
          // Save the final history with bot response
          await prisma.customer.update({
            where: { id: customer.id },
            data: {
              fullChatHistory: latestFullHistory as any,
              relevantChatHistory: latestRelevantHistory as any,
              lastInteraction: new Date()
            }
          });
          
          await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
          logger.info(`[History-Phase2] Bot response from job ${runId} saved for user ${userId}.`);
          
          // SEND RESPONSES ONLY AFTER SAVING HISTORY
          await sendResponsesFromContext(finalContext);
          
        } finally {
          if (lockAcquired) {
            await releaseUserLock(userId);
            logger.debug(`Lock released for user ${userId} - Phase 3 complete`);
          }
        }
      }
      
      // Handle special case of SKIP_HISTORY_UPDATE (like reset)
      else if (skipHistoryUpdate) {
        const contextFullHistory = finalContext.get(CONTEXT_KEYS.FULL_CHAT_HISTORY);
        const contextRelevantHistory = finalContext.get(CONTEXT_KEYS.RELEVANT_CHAT_HISTORY);
        
        // If context has empty histories (reset), save those
        if (Array.isArray(contextFullHistory) && contextFullHistory.length === 0) {
          await prisma.customer.update({
            where: { id: customer.id },
            data: {
              fullChatHistory: [],
              relevantChatHistory: [],
              lastInteraction: new Date()
            }
          });
          logger.info(`[History] Reset histories saved for user ${userId}.`);
        }
        
        // Send any responses even if history wasn't updated
        if (!wasCancelled) {
          await sendResponsesFromContext(finalContext);
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

// Helper function to check if a job is obsolete
async function isJobObsolete(job: Job<WhatsAppMessageJob>, latestMessageTimestampKey: string): Promise<boolean> {
  try {
    const latestCombinedStr = await redisService.get(latestMessageTimestampKey);
    if (!latestCombinedStr) return false;

    const [latestWAStr, latestServerStr] = latestCombinedStr.split(':');
    const latestWATimestamp = parseInt(latestWAStr, 10);
    const latestServerTimestamp = latestServerStr ? parseInt(latestServerStr, 10) : 0;

    const currentWATimestamp = parseInt(job.data.timestamp, 10);
    const currentServerTimestamp = job.data.serverTimestamp || 0;

    logger.info(`[DEBUG Pre-Process] Comparing timestamps - Current: ${currentWATimestamp}:${currentServerTimestamp}, Latest: ${latestWATimestamp}:${latestServerTimestamp}`);

    if (currentWATimestamp < latestWATimestamp) return true;
    if (currentWATimestamp === latestWATimestamp && currentServerTimestamp < latestServerTimestamp) return true;

    return false;
  } catch (error) {
    logger.warn(`[Pre-Process Check] Failed to check latest timestamp. Redis may be unavailable. Proceeding anyway.`, error);
    return false;
  }
}

// Helper function to check if a job was cancelled
async function wasJobCancelled(job: Job<WhatsAppMessageJob>): Promise<boolean> {
  const latestMessageTimestampKey = redisKeys.latestMessageTimestamp(job.data.from);
  return isJobObsolete(job, latestMessageTimestampKey);
}

// Helper function to send responses from context
async function sendResponsesFromContext(context: MessageContext): Promise<void> {
  for (const response of context.unifiedResponses) {
    if (!response.metadata.shouldSend) continue;
    
    try {
      // Send URL button if exists
      if (response.content?.urlButton) {
        const { title, body, buttonText, url } = response.content.urlButton;
        await sendMessageWithUrlButton(
          context.message.from,
          title,
          body,
          buttonText,
          url
        );
      }
      // Send text if exists
      else if (response.content?.text) {
        await sendWhatsAppMessage(context.message.from, response.content.text);
      }
      // Send interactive message if exists
      else if (response.content?.interactive) {
        await sendWhatsAppInteractiveMessage(
          context.message.from, 
          response.content.interactive
        );
      }
    } catch (error) {
      logger.error(`Error sending response for job ${context.runId}:`, error);
    }
  }
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