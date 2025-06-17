import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { prisma } from '../../../server';
import { sendWhatsAppMessage } from '../../whatsapp';
import { BANNED_USER_MESSAGE } from '../../../common/config/predefinedMessages';
import logger from '../../../common/utils/logger';

export class CustomerValidationMiddleware implements MessageMiddleware {
  name = 'CustomerValidationMiddleware';

  async process(context: MessageContext): Promise<MessageContext> {
    try {
      const customerId = context.message.from;
      
      // Obtener o crear cliente
      let customer = await prisma.customer.findUnique({
        where: { customerId }
      });

      if (!customer) {
        // Crear nuevo cliente
        customer = await prisma.customer.create({
          data: {
            customerId,
            lastInteraction: new Date(),
            fullChatHistory: [],
            relevantChatHistory: []
          }
        });
        
        // Marcar como cliente nuevo para mensaje de bienvenida
        context.set('isNewCustomer', true);
      } else {
        // Verificar si el cliente está baneado
        if (customer.isBanned) {
          logger.warn(`Banned customer ${customerId} tried to send a message`);
          const bannedMessage = await BANNED_USER_MESSAGE();
          await sendWhatsAppMessage(customerId, bannedMessage);
          context.stop();
          return context;
        }
      }

      context.setCustomer(customer);
      
      // Cargar historial de chat
      const fullChatHistory = Array.isArray(customer.fullChatHistory)
        ? customer.fullChatHistory
        : JSON.parse((customer.fullChatHistory as string) || "[]");
      
      const relevantChatHistory = Array.isArray(customer.relevantChatHistory)
        ? customer.relevantChatHistory
        : JSON.parse((customer.relevantChatHistory as string) || "[]");
      
      context.set('fullChatHistory', fullChatHistory);
      context.set('relevantChatHistory', relevantChatHistory);
      
      // Verificar si es una conversación nueva (más de 1 hora desde la última interacción)
      const isNewConversation = customer.lastInteraction && 
        (new Date().getTime() - new Date(customer.lastInteraction).getTime() > 60 * 60 * 1000) ||
        relevantChatHistory.length === 0;
      
      if (isNewConversation && !context.get('isNewCustomer')) {
        context.set('isNewConversation', true);
        // Reiniciar historial relevante para conversación nueva
        context.set('relevantChatHistory', []);
      }

      return context;
    } catch (error) {
      logger.error('Error in CustomerValidationMiddleware:', error);
      context.setError(error as Error);
      return context;
    }
  }
}