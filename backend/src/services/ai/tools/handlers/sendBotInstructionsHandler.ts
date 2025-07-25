import { ToolHandler } from '../types';
import { CHATBOT_HELP_MESSAGE } from '../../../../common/config/predefinedMessages';
import { ConfigService } from '../../../config/ConfigService';
import { UnifiedResponse, ResponseBuilder, ResponseType } from '../../../messaging/types/responses';
import logger from '../../../../common/utils/logger';

/**
 * Handles the send_bot_instructions function call
 * Sends instructions on how to use the bot
 */
export const handleSendBotInstructions: ToolHandler = async (): Promise<UnifiedResponse> => {
  
  const config = ConfigService.getConfig();
  const instructions = CHATBOT_HELP_MESSAGE(config);
  
  // Create and return unified response directly
  const response = ResponseBuilder.text(instructions, true);
  response.metadata.type = ResponseType.BOT_INSTRUCTIONS;
  
  return response;
};