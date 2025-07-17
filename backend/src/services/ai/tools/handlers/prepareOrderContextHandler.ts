import { ToolHandler, ToolResponse } from '../types';
import { MessageContext } from '../../../messaging/MessageContext';
import { MenuSearchService } from '../../MenuSearchService';
import { AgentService } from '../../AgentService';
import logger from '../../../../common/utils/logger';

/**
 * Handles the prepare_order_context function call
 * Prepares context for the order agent with relevant menu items
 */
export const handlePrepareOrderContext: ToolHandler = async (args, context?: MessageContext): Promise<ToolResponse | ToolResponse[]> => {
  // Get relevant menu based on mentioned items
  const relevantMenu = await MenuSearchService.getRelevantMenu(args.itemsSummary);
  
  // If no relevant products found
  if (relevantMenu === "[]" || JSON.parse(relevantMenu).length === 0) {
    logger.warn('No relevant products found for order context');
    
    return {
      text: `😔 No pude encontrar productos que coincidan con "${args.itemsSummary}". Por favor, intenta con otro nombre o revisa nuestro menú.`,
      isRelevant: true
    };
  }
  
  // Create context for order agent
  const orderContext = {
    itemsSummary: args.itemsSummary,
    relevantMenu: relevantMenu,
    orderType: args.orderType
  };
  
  // Process with order agent
  logger.debug('Calling processOrderMapping with context:', orderContext);
  const orderResponse = await AgentService.processOrderMapping(orderContext);
  logger.debug('Order agent response:', JSON.stringify(orderResponse, null, 2));
  
  // Import TextProcessingService to avoid circular dependency
  const { TextProcessingService } = await import('../../../messaging/TextProcessingService');
  
  // Process the order agent response
  const orderResults = await (TextProcessingService as any).processGeminiResponse(orderResponse, context);
  logger.debug('Processed order results:', orderResults);
  
  // The order agent should always execute map_order_items
  // So we return all results
  return orderResults;
};