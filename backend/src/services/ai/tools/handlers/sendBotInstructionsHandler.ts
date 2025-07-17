import { ToolHandler, ToolResponse } from '../types';
import { CHATBOT_HELP_MESSAGE } from '../../../../common/config/predefinedMessages';
import { ConfigService } from '../../../config/ConfigService';
import logger from '../../../../common/utils/logger';

/**
 * Handles the send_bot_instructions function call
 * Sends instructions on how to use the bot
 */
export const handleSendBotInstructions: ToolHandler = async (): Promise<ToolResponse> => {
  logger.debug('Sending bot instructions');
  
  const config = ConfigService.getConfig();
  const instructions = CHATBOT_HELP_MESSAGE(config);
  
  return {
    text: instructions,
    isRelevant: true
  };
};