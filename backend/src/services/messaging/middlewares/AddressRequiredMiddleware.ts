import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { sendMessageWithUrlButton } from '../../whatsapp';
import { LinkGenerationService } from '../../security/LinkGenerationService';
import { CONTEXT_KEYS } from '../../../common/constants';
import logger from '../../../common/utils/logger';

export class AddressRequiredMiddleware implements MessageMiddleware {
  name = 'AddressRequiredMiddleware';

  async process(context: MessageContext): Promise<MessageContext> {
    try {
      const hasNoAddress = context.get(CONTEXT_KEYS.HAS_NO_ADDRESS);
      const customerId = context.message.from;
      
      // Si el cliente no tiene dirección, bloquear la conversación
      if (hasNoAddress) {
        logger.info(`Blocking conversation for customer ${customerId} - no address on file`);
        
        // Generar enlace de registro - directo al formulario para primera vez
        const registrationLink = await LinkGenerationService.generateNewAddressLink(customerId);
        
        // Enviar mensaje con botón URL
        await sendMessageWithUrlButton(
          customerId,
          "🏠 ¡Bienvenido!",
          "Para poder tomar tu pedido, necesitamos que registres tu dirección de entrega.\n\nEs muy fácil y rápido:\n• Haz clic en el botón de abajo\n• Completa tu información\n• ¡Listo para ordenar!",
          "Registrar Dirección",
          registrationLink
        );
        
        // Detener el procesamiento - no procesar ningún mensaje hasta que tenga dirección
        context.stop();
        return context;
      }
      
      return context;
    } catch (error) {
      logger.error('Error in AddressRequiredMiddleware:', error);
      context.setError(error as Error);
      return context;
    }
  }
}