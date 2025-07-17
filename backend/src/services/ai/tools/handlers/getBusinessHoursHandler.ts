import { ToolHandler, ToolResponse } from '../types';
import { RESTAURANT_INFO_MESSAGE } from '../../../../common/config/predefinedMessages';
import { ConfigService } from '../../../config/ConfigService';
import { getFormattedBusinessHours } from '../../../../common/utils/timeUtils';
import logger from '../../../../common/utils/logger';

/**
 * Handles the get_business_hours function call
 * Returns restaurant information and business hours
 */
export const handleGetBusinessHours: ToolHandler = async (): Promise<ToolResponse> => {
  const config = ConfigService.getConfig();
  const formattedHours = await getFormattedBusinessHours();
  const infoMessage = RESTAURANT_INFO_MESSAGE(config, formattedHours);
  
  return {
    text: infoMessage,
    isRelevant: true
  };
};