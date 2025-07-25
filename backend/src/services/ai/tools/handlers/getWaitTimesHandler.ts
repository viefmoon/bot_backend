import { ToolHandler } from '../types';
import { WAIT_TIMES_MESSAGE } from '../../../../common/config/predefinedMessages';
import { RestaurantService } from '../../../restaurant/RestaurantService';
import { UnifiedResponse, ResponseBuilder, ResponseType } from '../../../messaging/types/responses';
import logger from '../../../../common/utils/logger';

/**
 * Handles the get_wait_times function call
 * Returns estimated wait times for pickup and delivery
 */
export const handleGetWaitTimes: ToolHandler = async (): Promise<UnifiedResponse> => {
  
  const config = await RestaurantService.getConfig();
  
  const waitTimesMessage = WAIT_TIMES_MESSAGE(
    config.estimatedPickupTime,
    config.estimatedDeliveryTime
  );
  
  // Create and return UnifiedResponse directly
  const unifiedResponse = ResponseBuilder.text(waitTimesMessage, true);
  unifiedResponse.metadata.type = ResponseType.WAIT_TIME_INFO;
  
  return unifiedResponse;
};