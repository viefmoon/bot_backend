import { ToolHandler, ToolResponse } from '../types';
import { WAIT_TIMES_MESSAGE } from '../../../../common/config/predefinedMessages';
import { RestaurantService } from '../../../restaurant/RestaurantService';
import logger from '../../../../common/utils/logger';

/**
 * Handles the get_wait_times function call
 * Returns estimated wait times for pickup and delivery
 */
export const handleGetWaitTimes: ToolHandler = async (): Promise<ToolResponse> => {
  logger.debug('Getting wait times');
  
  const config = await RestaurantService.getConfig();
  
  const waitTimesMessage = WAIT_TIMES_MESSAGE(
    config.estimatedPickupTime,
    config.estimatedDeliveryTime
  );
  
  return {
    text: waitTimesMessage,
    isRelevant: true
  };
};