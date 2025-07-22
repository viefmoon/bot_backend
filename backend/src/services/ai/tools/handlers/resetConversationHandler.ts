import { ToolHandler } from '../types';
import { MessageContext } from '../../../messaging/MessageContext';
import { prisma } from '../../../../lib/prisma';
import { CONVERSATION_RESET_MESSAGE } from '../../../../common/config/predefinedMessages';
import { SyncMetadataService } from '../../../sync/SyncMetadataService';
import { TechnicalError, ErrorCode } from '../../../../common/services/errors';
import { UnifiedResponse, ResponseBuilder, ResponseType } from '../../../messaging/types/responses';
import { CONTEXT_KEYS } from '../../../../common/constants';
import logger from '../../../../common/utils/logger';

/**
 * Handles the reset_conversation function call
 * Clears chat history and resets conversation state
 */
export const handleResetConversation: ToolHandler = async (args, context?: MessageContext): Promise<UnifiedResponse> => {
  // Get customerId from context
  const customerId = context?.customer?.id;
  const whatsappNumber = context?.customer?.whatsappPhoneNumber;
  
  if (!customerId) {
    throw new TechnicalError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Could not get customer ID from context'
    );
  }
  
  logger.info(`[Reset Conversation] Clearing history for customer ${whatsappNumber}`);
  
  // Reset chat history immediately
  await prisma.customer.update({
    where: { id: customerId },
    data: { 
      relevantChatHistory: [],
      fullChatHistory: [],
      lastInteraction: new Date()
    }
  });
  
  // Mark for sync
  await SyncMetadataService.markForSync('Customer', customerId, 'REMOTE');
  
  // Clear context history completely
  context?.set(CONTEXT_KEYS.RELEVANT_CHAT_HISTORY, []);
  context?.set(CONTEXT_KEYS.FULL_CHAT_HISTORY, []);
  
  // Mark to skip history update
  context?.set(CONTEXT_KEYS.SKIP_HISTORY_UPDATE, true);
  
  // Mark that conversation is being reset to avoid welcome message
  context?.set(CONTEXT_KEYS.IS_RESETTING_CONVERSATION, true);
  
  // Create and return unified response directly
  const response = ResponseBuilder.text(CONVERSATION_RESET_MESSAGE, false);
  response.metadata.type = ResponseType.CONVERSATION_RESET;
  
  return response;
};