import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { sendWhatsAppMessage, sendWhatsAppInteractiveMessage } from '../../whatsapp';
import { WELCOME_MESSAGE_INTERACTIVE, UNSUPPORTED_MESSAGE_TYPE } from '../../../common/config/predefinedMessages';
import logger from '../../../common/utils/logger';

export class MessageTypeMiddleware implements MessageMiddleware {
  name = 'MessageTypeMiddleware';

  async process(context: MessageContext): Promise<MessageContext> {
    try {
      // Verificar si es un cliente nuevo o conversación nueva que necesita mensaje de bienvenida
      const customer = context.customer;
      const isVeryNewCustomer = customer && customer.createdAt && 
        (new Date().getTime() - new Date(customer.createdAt).getTime() < 5 * 60 * 1000); // Created less than 5 minutes ago
      
      // Only send welcome if it's a new conversation (not a brand new customer who just registered)
      if (context.get('isNewConversation') && !isVeryNewCustomer) {
        const welcomeMessage = await WELCOME_MESSAGE_INTERACTIVE();
        await sendWhatsAppInteractiveMessage(context.message.from, welcomeMessage);
      }
      
      // La detección de reinicio ahora se maneja a través del agente general
      
      // Validar tipo de mensaje
      const supportedTypes = ['text', 'interactive', 'audio'];
      if (!supportedTypes.includes(context.message.type)) {
        await sendWhatsAppMessage(context.message.from, UNSUPPORTED_MESSAGE_TYPE);
        context.stop();
        return context;
      }
      
      // Establecer tipo de mensaje para procesamiento
      context.set('messageType', context.message.type);
      
      // Para mensajes de audio, necesitaremos manejar la transcripción
      if (context.message.type === 'audio') {
        context.set('needsTranscription', true);
      }
      
      return context;
    } catch (error) {
      logger.error('Error in MessageTypeMiddleware:', error);
      context.setError(error as Error);
      return context;
    }
  }
}