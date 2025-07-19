import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { RestaurantService } from '../../restaurant/RestaurantService';
import { sendWhatsAppMessage } from '../../whatsapp';
import { RESTAURANT_CLOSED_MESSAGE } from '../../../common/config/predefinedMessages';
import { getFormattedBusinessHours } from '../../../common/utils/timeUtils';
import logger from '../../../common/utils/logger';
import { getCurrentMexicoTime } from '../../../common/utils/timeUtils';

export class RestaurantHoursMiddleware implements MessageMiddleware {
  name = 'RestaurantHoursMiddleware';

  async process(context: MessageContext): Promise<MessageContext> {
    try {
      // Get restaurant configuration
      const config = await RestaurantService.getConfig();
      
      // PRIORITY 1: Check if restaurant is accepting orders
      // This is the master switch - if true, we process orders regardless of hours
      if (config.acceptingOrders) {
        // Restaurant wants to accept orders - continue processing
        return context;
      }
      
      // PRIORITY 2: Restaurant is NOT accepting orders
      // Now we check WHY to give an appropriate message
      
      // Get current restaurant time
      const currentTime = await getCurrentMexicoTime();
      const dayOfWeek = currentTime.day();
      const currentMinutes = currentTime.hours() * 60 + currentTime.minutes();

      // Get business hours for today
      const businessHours = await RestaurantService.getBusinessHoursForDay(dayOfWeek);
      
      let message: string;
      
      // Check if it's a scheduled closed day
      if (!businessHours || businessHours.isClosed || !businessHours.openingTime || !businessHours.closingTime) {
        logger.info(`Restaurant is closed on day ${dayOfWeek}`);
        // It's a regularly scheduled closed day
        const formattedHours = await getFormattedBusinessHours();
        message = RESTAURANT_CLOSED_MESSAGE(formattedHours);
      } else {
        // Parse opening and closing times
        const [openHour, openMinute] = businessHours.openingTime.split(':').map(Number);
        const [closeHour, closeMinute] = businessHours.closingTime.split(':').map(Number);
        
        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;
        
        // Apply grace periods
        const effectiveOpenTime = openTime + (config.openingGracePeriod || 0);
        const effectiveCloseTime = closeTime - (config.closingGracePeriod || 0);
        
        // Check if we're within normal operating hours
        if (currentMinutes >= effectiveOpenTime && currentMinutes <= effectiveCloseTime) {
          // We're in operating hours but acceptingOrders is false
          // This suggests temporary closure (high demand, technical issues, etc.)
          message = `🚫 En este momento no estamos tomando pedidos.

⏰ Nuestro horario regular es de ${businessHours.openingTime} a ${businessHours.closingTime}.

Por favor, intenta más tarde o comunícate directamente al restaurante.

¡Gracias por tu comprensión! 🙏`;
        } else {
          // We're outside operating hours
          if (currentMinutes < effectiveOpenTime) {
            // Before opening
            const minutesUntilOpen = effectiveOpenTime - currentMinutes;
            const hoursUntilOpen = Math.floor(minutesUntilOpen / 60);
            const minsUntilOpen = minutesUntilOpen % 60;
            
            message = `⏰ Aún no estamos recibiendo pedidos.

🕐 Comenzaremos a tomar pedidos ${hoursUntilOpen > 0 ? `en ${hoursUntilOpen} hora${hoursUntilOpen > 1 ? 's' : ''} y ${minsUntilOpen} minutos` : `en ${minsUntilOpen} minutos`}.

📍 *Horario de atención:*
${businessHours.openingTime} a ${businessHours.closingTime}

¡Te esperamos! 😊`;
          } else {
            // After closing
            message = `⏰ Ya hemos cerrado por hoy.

📍 *Nuestro horario de atención es:*
${businessHours.openingTime} a ${businessHours.closingTime}

¡Te esperamos mañana! 😊`;
          }
        }
      }
      
      await sendWhatsAppMessage(context.message.from, message);
      context.stop();
      return context;
    } catch (error) {
      logger.error('Error in RestaurantHoursMiddleware:', error);
      // In case of error, allow message to continue (fail open)
      return context;
    }
  }
}