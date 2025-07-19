/**
 * Informational interactive message handlers
 */
import { prisma } from '../../../lib/prisma';
import { sendWhatsAppMessage } from '../../../services/whatsapp';
import { getMenuResponses } from '../../../services/ai/tools/handlers/sendMenuHandler';
import { 
  WAIT_TIMES_MESSAGE,
  RESTAURANT_INFO_MESSAGE,
  CHATBOT_HELP_MESSAGE 
} from '../../../common/config/predefinedMessages';
import { ConfigService } from '../../../services/config/ConfigService';
import { getFormattedBusinessHours } from '../../../common/utils/timeUtils';
import { BusinessLogicError, ErrorCode } from '../../../common/services/errors';
import { UnifiedResponse, ResponseBuilder } from '../../../services/messaging/types';
import logger from '../../../common/utils/logger';

/**
 * Send menu to customer
 */
export async function sendMenu(phoneNumber: string): Promise<UnifiedResponse[]> {
  // Usa la lógica centralizada para obtener y dividir el menú
  const toolResponse = await getMenuResponses();
  
  // Normaliza a array para manejar ambos casos (respuesta única o múltiple)
  const responses = Array.isArray(toolResponse) ? toolResponse : [toolResponse];
  
  // Add history marker to the first response
  if (responses.length > 0 && responses[0]) {
    responses[0] = ResponseBuilder.textWithHistoryMarker(
      responses[0].content?.text || '',
      "[ACCIÓN DEL BOT]: Envió el menú completo del restaurante."
    );
  }
  
  return responses;
}

/**
 * Handle wait times request
 */
export async function handleWaitTimes(customerId: string): Promise<UnifiedResponse> {
  const config = await prisma.restaurantConfig.findFirst();
  if (!config) {
    throw new BusinessLogicError(ErrorCode.DATABASE_ERROR, 'Restaurant configuration not found');
  }
  const message = WAIT_TIMES_MESSAGE(
    config.estimatedPickupTime,
    config.estimatedDeliveryTime
  );
  
  return ResponseBuilder.textWithHistoryMarker(
    message,
    "[ACCIÓN DEL BOT]: Respondió con los tiempos de espera."
  );
}

/**
 * Handle restaurant info request
 */
export async function handleRestaurantInfo(customerId: string): Promise<UnifiedResponse> {
  const config = ConfigService.getConfig();
  const formattedHours = await getFormattedBusinessHours();
  const message = RESTAURANT_INFO_MESSAGE(config, formattedHours);
  
  return ResponseBuilder.textWithHistoryMarker(
    message,
    "[ACCIÓN DEL BOT]: Envió la información del restaurante."
  );
}

/**
 * Handle chatbot help request
 */
export async function handleChatbotHelp(whatsappPhoneNumber: string): Promise<UnifiedResponse> {
  const config = ConfigService.getConfig();
  const message = CHATBOT_HELP_MESSAGE(config);
  
  return ResponseBuilder.textWithHistoryMarker(
    message,
    "[ACCIÓN DEL BOT]: Envió las instrucciones de ayuda del chatbot."
  );
}