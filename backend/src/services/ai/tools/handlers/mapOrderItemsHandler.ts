import { ToolHandler } from '../types';
import { AIOrderItem, transformAIOrderItem } from '../../../../common/types';
import { UnifiedResponse, ResponseBuilder } from '../../../messaging/types/responses';
import logger from '../../../../common/utils/logger';

/**
 * Handles the map_order_items function call
 * Transforms AI order items to consistent format for pre-order creation
 */
export const handleMapOrderItems: ToolHandler = async (args): Promise<UnifiedResponse> => {
  logger.debug('Processing map_order_items with args:', args);
  
  // Transform AI order items to consistent format
  const processedItems = (args.orderItems || []).map((item: AIOrderItem) => 
    transformAIOrderItem(item)
  );
  
  // Return UnifiedResponse with processed data
  return ResponseBuilder.orderProcessing({
    orderItems: processedItems,
    orderType: args.orderType || 'DELIVERY',
    warnings: args.warnings ? [args.warnings] : [],
    scheduledAt: args.scheduledAt || null
  });
};