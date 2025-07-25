import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { sendWhatsAppInteractiveMessage } from '../../whatsapp';
import { CONTEXT_KEYS } from '../../../common/constants';
import logger from '../../../common/utils/logger';
import { ConfigService } from '../../config/ConfigService';

export class NewCustomerGreetingMiddleware implements MessageMiddleware {
  name = 'NewCustomerGreetingMiddleware';

  async process(context: MessageContext): Promise<MessageContext> {
    // Esta condición identifica a un cliente que aún no ha completado su registro.
    const isNewCustomer = context.get(CONTEXT_KEYS.IS_NEW_CUSTOMER);
    const hasNoName = !context.customer?.firstName;
    const hasNoAddress = context.get(CONTEXT_KEYS.HAS_NO_ADDRESS);
    
    // Verificar si es un mensaje interactivo (respuesta a botón)
    const isInteractiveMessage = context.message.type === 'interactive';
    
    // Si es un mensaje interactivo y es una respuesta de registro, permitir que pase
    if (isInteractiveMessage && context.message.interactive?.button_reply?.id) {
      const buttonId = context.message.interactive.button_reply.id;
      const isRegistrationAction = buttonId === 'request_delivery_registration' || 
                                  buttonId === 'request_pickup_registration';
      if (isRegistrationAction) {
        logger.info(`Allowing registration action ${buttonId} to pass through`);
        return context;
      }
    }
    
    // Interceptar si el cliente no tiene nombre (independientemente de si es nuevo o no)
    // Esto maneja casos donde el cliente fue creado pero el registro falló
    const needsRegistration = hasNoName;

    if (needsRegistration) {

      // Obtener el nombre del restaurante de la configuración
      const config = ConfigService.getConfig();
      const restaurantName = config.restaurantName || 'nuestro restaurante';

      const greetingMessage = {
        type: "button",
        body: {
          text: `¡Hola! 👋 ¡Bienvenido a *${restaurantName}*!\n\n📝 Estamos listos para tomar tu orden.\n\n¿Cómo prefieres recibir tu pedido?`
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: "request_delivery_registration",
                title: "Entrega a domicilio"
              }
            },
            {
              type: "reply",
              reply: {
                id: "request_pickup_registration",
                title: "Recoger en tienda"
              }
            }
          ]
        }
      };

      await sendWhatsAppInteractiveMessage(context.message.from, greetingMessage);
      
      // Detenemos el pipeline aquí para esperar la respuesta del cliente.
      context.stop();
    }

    return context;
  }
}