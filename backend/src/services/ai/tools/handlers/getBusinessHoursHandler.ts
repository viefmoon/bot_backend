import { ToolHandler } from '../types';
import { RESTAURANT_INFO_MESSAGE } from '../../../../common/config/predefinedMessages';
import { ConfigService } from '../../../config/ConfigService';
import { getFormattedBusinessHours } from '../../../../common/utils/timeUtils';
import { UnifiedResponse, ResponseBuilder, ResponseType } from '../../../messaging/types/responses';
import logger from '../../../../common/utils/logger';

/**
 * Handles the get_business_hours function call
 * Returns restaurant information and business hours
 */
export const handleGetBusinessHours: ToolHandler = async (): Promise<UnifiedResponse> => {
  const config = ConfigService.getConfig();
  const formattedHours = await getFormattedBusinessHours();
  const infoMessage = RESTAURANT_INFO_MESSAGE(config, formattedHours);
  
  // Create and return UnifiedResponse directly
  const unifiedResponse = ResponseBuilder.text(infoMessage, true);
  unifiedResponse.metadata.type = ResponseType.RESTAURANT_INFO;
  
  return unifiedResponse;
};