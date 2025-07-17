import { MessageProcessor } from '../services/messaging/MessageProcessor';
import { IncomingMessage } from '../services/messaging/types';
import { WhatsAppMessageJob } from '../queues/types';
import logger from '../common/utils/logger';

/**
 * Process a WhatsApp message job from the queue
 * This runs in a separate worker process/thread
 */
export async function processMessageJob(messageData: WhatsAppMessageJob): Promise<void> {
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
    
    logger.info(`Worker processing message ${messageData.id} from ${messageData.from}, type: ${messageData.type}`);
    
    // Process the message through the existing pipeline
    await MessageProcessor.processWithPipeline(incomingMessage);
    
    const processingTime = Date.now() - startTime;
    logger.info(`Message ${messageData.id} from ${messageData.from} processed successfully in ${processingTime}ms`);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`Worker failed to process message ${messageData.id} from ${messageData.from} after ${processingTime}ms:`, error);
    
    // Re-throw the error so BullMQ can handle retries according to configuration
    throw error;
  }
}