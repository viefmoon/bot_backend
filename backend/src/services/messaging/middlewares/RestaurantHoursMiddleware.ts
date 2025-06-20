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
      
      // Check if restaurant is accepting orders
      if (!config.acceptingOrders) {
        const formattedHours = await getFormattedBusinessHours();
        const closedMessage = RESTAURANT_CLOSED_MESSAGE(formattedHours);
        await sendWhatsAppMessage(context.message.from, closedMessage);
        context.stop();
        return context;
      }

      // Get current restaurant time
      const currentTime = await getCurrentMexicoTime();
      const dayOfWeek = currentTime.day();
      const currentMinutes = currentTime.hours() * 60 + currentTime.minutes();

      // Get business hours for today
      const businessHours = await RestaurantService.getBusinessHoursForDay(dayOfWeek);
      
      if (!businessHours || businessHours.isClosed || !businessHours.openingTime || !businessHours.closingTime) {
        logger.info(`Restaurant is closed on day ${dayOfWeek}`);
        const formattedHours = await getFormattedBusinessHours();
        const closedMessage = RESTAURANT_CLOSED_MESSAGE(formattedHours);
        await sendWhatsAppMessage(context.message.from, closedMessage);
        context.stop();
        return context;
      }

      // Parse opening and closing times
      const [openHour, openMinute] = businessHours.openingTime.split(':').map(Number);
      const [closeHour, closeMinute] = businessHours.closingTime.split(':').map(Number);
      
      const openTime = openHour * 60 + openMinute;
      const closeTime = closeHour * 60 + closeMinute;
      
      // Apply grace periods
      const effectiveOpenTime = openTime + (config.openingGracePeriod || 0);
      const effectiveCloseTime = closeTime - (config.closingGracePeriod || 0);

      // Check if current time is within operating hours (with grace periods)
      if (currentMinutes < effectiveOpenTime || currentMinutes > effectiveCloseTime) {
        logger.info(`Restaurant hours check failed: current=${currentMinutes}, open=${effectiveOpenTime}, close=${effectiveCloseTime}`);
        
        // Check if we're in a grace period
        let message: string;
        if (currentMinutes >= openTime && currentMinutes < effectiveOpenTime) {
          // In opening grace period
          const minutesUntilOpen = effectiveOpenTime - currentMinutes;
          message = `⏰ ¡Buenos días! Aunque nuestro restaurante ya abrió, todavía no estamos recibiendo pedidos.

🕐 Comenzaremos a tomar pedidos en ${minutesUntilOpen} minutos.

📍 *Horario de hoy:*
Apertura: ${businessHours.openingTime}
Inicio de pedidos: ${Math.floor(effectiveOpenTime / 60)}:${(effectiveOpenTime % 60).toString().padStart(2, '0')}
Cierre de pedidos: ${Math.floor(effectiveCloseTime / 60)}:${(effectiveCloseTime % 60).toString().padStart(2, '0')}
Cierre: ${businessHours.closingTime}

¡Gracias por tu paciencia! 🙏`;
        } else if (currentMinutes > effectiveCloseTime && currentMinutes <= closeTime) {
          // In closing grace period
          message = `⏰ Lo sentimos, ya no estamos recibiendo nuevos pedidos por hoy.

🕐 Dejamos de tomar pedidos ${config.closingGracePeriod} minutos antes del cierre para garantizar la calidad del servicio.

📍 *Horario de hoy:*
Último pedido: ${Math.floor(effectiveCloseTime / 60)}:${(effectiveCloseTime % 60).toString().padStart(2, '0')}
Cierre: ${businessHours.closingTime}

¡Te esperamos mañana! 😊`;
        } else {
          // Outside business hours completely
          const formattedHours = await getFormattedBusinessHours();
          const closedMessage = RESTAURANT_CLOSED_MESSAGE(formattedHours);
          message = closedMessage;
        }
        
        await sendWhatsAppMessage(context.message.from, message);
        context.stop();
        return context;
      }

      // Restaurant is open, continue processing
      return context;
    } catch (error) {
      logger.error('Error in RestaurantHoursMiddleware:', error);
      // In case of error, allow message to continue (fail open)
      return context;
    }
  }
}