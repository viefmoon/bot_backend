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
import logger from '../../../common/utils/logger';

/**
 * Send menu to customer
 */
export async function sendMenu(phoneNumber: string): Promise<void> {
  // No hay try...catch aquí. Si algo falla, el error sube al manejador principal.
  
  // Usa la lógica centralizada para obtener y dividir el menú
  const toolResponse = await getMenuResponses();
  
  // Normaliza a array para manejar ambos casos (respuesta única o múltiple)
  const responses = Array.isArray(toolResponse) ? toolResponse : [toolResponse];
  
  // Envía cada parte del menú por separado
  // La división ya fue manejada por getMenuResponses usando splitMenu
  for (const response of responses) {
    if (response && response.content?.text) {
      // sendWhatsAppMessage no volverá a dividir porque cada parte es < 3500 chars
      const result = await sendWhatsAppMessage(phoneNumber, response.content.text);
      if (!result) {
        // Lanza un error para que el manejador principal lo capture
        throw new BusinessLogicError(
          ErrorCode.WHATSAPP_ERROR,
          `Failed to send menu part to ${phoneNumber}`
        );
      }
    }
  }
}

/**
 * Handle wait times request
 */
export async function handleWaitTimes(customerId: string): Promise<void> {
  const config = await prisma.restaurantConfig.findFirst();
  if (!config) {
    throw new BusinessLogicError(ErrorCode.DATABASE_ERROR, 'Restaurant configuration not found');
  }
  const message = WAIT_TIMES_MESSAGE(
    config.estimatedPickupTime,
    config.estimatedDeliveryTime
  );
  await sendWhatsAppMessage(customerId, message);
}

/**
 * Handle restaurant info request
 */
export async function handleRestaurantInfo(customerId: string): Promise<void> {
  const config = ConfigService.getConfig();
  const formattedHours = await getFormattedBusinessHours();
  const message = RESTAURANT_INFO_MESSAGE(config, formattedHours);
  await sendWhatsAppMessage(customerId, message);
}

/**
 * Handle chatbot help request
 */
export async function handleChatbotHelp(whatsappPhoneNumber: string): Promise<void> {
  const config = ConfigService.getConfig();
  const message = CHATBOT_HELP_MESSAGE(config);
  await sendWhatsAppMessage(whatsappPhoneNumber, message);
}