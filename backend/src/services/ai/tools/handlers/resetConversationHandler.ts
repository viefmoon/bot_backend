import { ToolHandler, ToolResponse } from '../types';
import { MessageContext } from '../../../messaging/MessageContext';
import { prisma } from '../../../../server';
import { CONVERSATION_RESET_MESSAGE } from '../../../../common/config/predefinedMessages';
import { SyncMetadataService } from '../../../sync/SyncMetadataService';
import { TechnicalError, ErrorCode } from '../../../../common/services/errors';
import logger from '../../../../common/utils/logger';

/**
 * Handles the reset_conversation function call
 * Clears chat history and resets conversation state
 */
export const handleResetConversation: ToolHandler = async (args, context?: MessageContext): Promise<ToolResponse> => {
  logger.debug('Resetting conversation');
  
  // Get customerId from context
  const customerId = context?.customer?.id;
  if (!customerId) {
    throw new TechnicalError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Could not get customer ID from context'
    );
  }
  
  // Reset chat history immediately
  await prisma.customer.update({
    where: { id: customerId },
    data: { 
      relevantChatHistory: JSON.stringify([]),
      fullChatHistory: JSON.stringify([]),
      lastInteraction: new Date()
    }
  });
  
  // Mark for sync
  await SyncMetadataService.markForSync('Customer', customerId, 'REMOTE');
  
  // Clear context history completely
  context?.set('relevantChatHistory', []);
  context?.set('fullChatHistory', []);
  
  // Mark to skip history update
  context?.set('skipHistoryUpdate', true);
  
  // Mark that conversation is being reset to avoid welcome message
  context?.set('isResettingConversation', true);
  
  return {
    text: CONVERSATION_RESET_MESSAGE,
    isRelevant: false
  };
};