import { MessageProcessor } from '../services/messaging/MessageProcessor';
import { IncomingMessage } from '../services/messaging/types';
import { WhatsAppMessageJob } from '../queues/types';
import logger from '../common/utils/logger';
import { startMessageWorker } from '../queues/messageQueue';

/**
 * Process a WhatsApp message job from the queue
 * This runs in a separate worker process/thread
 */
export async function processMessageJob(messageData: WhatsAppMessageJob, runId: string): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Convert job data to IncomingMessage format
    const incomingMessage: IncomingMessage = {
      id: messageData.id,
      from: messageData.from,
      type: messageData.type as 'text' | 'interactive' | 'audio' | 'image' | 'document' | 'location',
      timestamp: messageData.timestamp,
      text: messageData.text,
      interactive: messageData.interactive,
      audio: messageData.audio
    };
    
    logger.info(`Worker processing message ${messageData.id} (runId: ${runId}) from ${messageData.from}, type: ${messageData.type}`);
    
    // Process the message through the existing pipeline with runId
    await MessageProcessor.processWithPipeline(incomingMessage, runId);
    
    const processingTime = Date.now() - startTime;
    logger.info(`Message ${messageData.id} (runId: ${runId}) from ${messageData.from} processed successfully in ${processingTime}ms`);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`Worker failed to process message ${messageData.id} (runId: ${runId}) from ${messageData.from} after ${processingTime}ms:`, error);
    
    // Re-throw the error so BullMQ can handle retries according to configuration
    throw error;
  }
}

// Start the worker when this file is executed directly
if (require.main === module) {
  logger.info('Starting message worker process...');
  startMessageWorker();
}