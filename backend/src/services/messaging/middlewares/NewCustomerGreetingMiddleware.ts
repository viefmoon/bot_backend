import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { sendWhatsAppInteractiveMessage } from '../../whatsapp';
import { CONTEXT_KEYS } from '../../../common/constants';
import logger from '../../../common/utils/logger';

export class NewCustomerGreetingMiddleware implements MessageMiddleware {
  name = 'NewCustomerGreetingMiddleware';

  async process(context: MessageContext): Promise<MessageContext> {
    // Esta condición identifica a un cliente recién creado que aún no ha interactuado.
    const isNewCustomer = context.get(CONTEXT_KEYS.IS_NEW_CUSTOMER);
    const hasNoName = !context.customer?.firstName;
    const hasNoAddress = context.get(CONTEXT_KEYS.HAS_NO_ADDRESS);
    
    // Solo interceptar si es un cliente completamente nuevo (sin nombre ni dirección)
    const isBrandNewCustomer = isNewCustomer && hasNoName && hasNoAddress;

    if (isBrandNewCustomer) {
      logger.info(`Customer ${context.message.from} is brand new. Sending order type selection.`);

      const greetingMessage = {
        type: "button",
        body: {
          text: `¡Hola! 👋 ¡Bienvenido! Para empezar, ¿cómo te gustaría realizar tu pedido?`
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: "request_delivery_registration",
                title: "🚚 A domicilio"
              }
            },
            {
              type: "reply",
              reply: {
                id: "request_pickup_registration",
                title: "🏠 Recoger en tienda"
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