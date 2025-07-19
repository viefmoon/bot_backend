/**
 * Main interactive message handler
 * Delegates to domain-specific handlers via the action registry
 */
import logger from '../../common/utils/logger';
import { handleWhatsAppError } from '../../common/utils/whatsappErrorHandler';
import { findHandler } from './interactive';

/**
 * Handle interactive messages (button/list replies)
 * Routes to appropriate handler based on action ID
 */
export async function handleInteractiveMessage(
  from: string,
  message: any
): Promise<void> {
  try {
    logger.info('Interactive message received:', JSON.stringify(message));
    
    if (!message.interactive) {
      logger.error('No interactive property in message');
      return;
    }
    
    const reply = message.interactive.button_reply || message.interactive.list_reply;
    if (!reply) {
      logger.error('No reply found in interactive message');
      return;
    }

    const { id } = reply;
    logger.info(`Processing interactive reply: ${id}`);
    
    // Find and execute the appropriate handler
    const handler = findHandler(id);
    
    if (handler) {
      logger.info(`Executing handler for action: ${id}`);
      await handler(from, id);
    } else {
      logger.warn(`No handler found for interactive action: ${id}`);
    }
  } catch (error) {
    await handleWhatsAppError(error, from, {
      userId: from,
      operation: 'handleInteractiveMessage'
    });
  }
}