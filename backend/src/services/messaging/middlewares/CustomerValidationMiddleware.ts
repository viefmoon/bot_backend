import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { prisma } from '../../../lib/prisma';
import { sendWhatsAppMessage } from '../../whatsapp';
import { BANNED_USER_MESSAGE } from '../../../common/config/predefinedMessages';
import { ConfigService } from '../../../services/config/ConfigService';
import { CONTEXT_KEYS } from '../../../common/constants';
import logger from '../../../common/utils/logger';

export class CustomerValidationMiddleware implements MessageMiddleware {
  name = 'CustomerValidationMiddleware';

  async process(context: MessageContext): Promise<MessageContext> {
    try {
      // El cliente y el historial ya fueron cargados y ordenados por el worker
      const customer = context.customer;

      if (!customer) {
        logger.warn(`Customer object not found in context for message ${context.message.id}. Stopping pipeline.`);
        context.stop();
        return context;
      }
      
      // Verificar si está baneado
      if (customer.isBanned) {
        logger.warn(`Banned customer ${customer.whatsappPhoneNumber} tried to send a message`);
        const config = ConfigService.getConfig();
        const bannedMessage = BANNED_USER_MESSAGE(config);
        await sendWhatsAppMessage(customer.whatsappPhoneNumber, bannedMessage);
        context.stop();
        return context;
      }

      // Verificar si tiene direcciones
      const addressCount = await prisma.address.count({ 
        where: { 
          customerId: customer.id, 
          deletedAt: null 
        } 
      });
      
      if (addressCount === 0) {
        context.set(CONTEXT_KEYS.HAS_NO_ADDRESS, true);
        logger.info(`Customer ${customer.whatsappPhoneNumber} has no active addresses`);
      }

      // Verificar si es conversación nueva
      const relevantHistory = context.get(CONTEXT_KEYS.RELEVANT_CHAT_HISTORY) || [];
      const isNewConversation = !customer.lastInteraction || 
        (new Date().getTime() - new Date(customer.lastInteraction).getTime() > 60 * 60 * 1000) ||
        relevantHistory.filter((m: any) => m.role === 'assistant').length === 0;

      if (isNewConversation) {
        context.set(CONTEXT_KEYS.IS_NEW_CONVERSATION, true);
      }

      return context;
    } catch (error) {
      logger.error('Error in CustomerValidationMiddleware:', error);
      context.setError(error as Error);
      return context;
    }
  }
}