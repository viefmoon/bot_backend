import { ToolHandler } from './types';
import { handleMapOrderItems } from './handlers/mapOrderItemsHandler';
import { handleSendMenu } from './handlers/sendMenuHandler';
import { handleGetBusinessHours } from './handlers/getBusinessHoursHandler';
import { handlePrepareOrderContext } from './handlers/prepareOrderContextHandler';
import { handleGenerateAddressUpdateLink } from './handlers/generateAddressUpdateLinkHandler';
import { handleSendBotInstructions } from './handlers/sendBotInstructionsHandler';
import { handleGetWaitTimes } from './handlers/getWaitTimesHandler';
import { handleResetConversation } from './handlers/resetConversationHandler';

/**
 * Registry of all available tool handlers
 * Maps function names to their corresponding handler implementations
 */
export const toolHandlers: Record<string, ToolHandler> = {
  'map_order_items': handleMapOrderItems,
  'send_menu': handleSendMenu,
  'get_business_hours': handleGetBusinessHours,
  'prepare_order_context': handlePrepareOrderContext,
  'generate_address_update_link': handleGenerateAddressUpdateLink,
  'send_bot_instructions': handleSendBotInstructions,
  'get_wait_times': handleGetWaitTimes,
  'reset_conversation': handleResetConversation,
};

/**
 * Get a tool handler by name
 * @param name The name of the function to handle
 * @returns The handler function or undefined if not found
 */
export function getToolHandler(name: string): ToolHandler | undefined {
  return toolHandlers[name];
}