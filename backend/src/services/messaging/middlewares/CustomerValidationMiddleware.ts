import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { prisma } from '../../../lib/prisma';
import { sendWhatsAppMessage } from '../../whatsapp';
import { BANNED_USER_MESSAGE } from '../../../common/config/predefinedMessages';
import { ConfigService } from '../../../services/config/ConfigService';
import { SyncMetadataService } from '../../../services/sync/SyncMetadataService';
import logger from '../../../common/utils/logger';

export class CustomerValidationMiddleware implements MessageMiddleware {
  name = 'CustomerValidationMiddleware';

  private removeDuplicateMessages(messages: any[]): any[] {
    if (messages.length === 0) return messages;
    
    const cleaned: any[] = [messages[0]];
    
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      
      // Si el mensaje actual es diferente al anterior, lo agregamos
      if (current.role !== previous.role || current.content !== previous.content) {
        cleaned.push(current);
      }
    }
    
    return cleaned;
  }

  async process(context: MessageContext): Promise<MessageContext> {
    try {
      const whatsappPhoneNumber = context.message.from;
      
      // Obtener o crear cliente con sus direcciones
      let customer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber },
        include: { addresses: true }
      });

      if (!customer) {
        // Crear nuevo cliente
        customer = await prisma.customer.create({
          data: {
            whatsappPhoneNumber,
            lastInteraction: new Date(),
            fullChatHistory: [],
            relevantChatHistory: []
          },
          include: { addresses: true }
        });
        
        // Mark for sync
        await SyncMetadataService.markForSync('Customer', customer.id, 'REMOTE');
        
        // Marcar como cliente nuevo para mensaje de bienvenida
        context.set('isNewCustomer', true);
        context.set('hasNoAddress', true);
      } else {
        // Verificar si el cliente está baneado
        if (customer.isBanned) {
          logger.warn(`Banned customer ${whatsappPhoneNumber} tried to send a message`);
          const config = ConfigService.getConfig();
          const bannedMessage = BANNED_USER_MESSAGE(config);
          await sendWhatsAppMessage(whatsappPhoneNumber, bannedMessage);
          context.stop();
          return context;
        }
        
        // Verificar si el cliente tiene direcciones activas
        const activeAddresses = customer.addresses.filter(addr => !addr.deletedAt);
        if (activeAddresses.length === 0) {
          context.set('hasNoAddress', true);
          logger.info(`Customer ${whatsappPhoneNumber} has no active addresses`);
        }
      }

      context.setCustomer(customer);
      
      // Cargar historial de chat
      const fullChatHistory = Array.isArray(customer.fullChatHistory)
        ? customer.fullChatHistory
        : JSON.parse((customer.fullChatHistory as string) || "[]");
      
      let relevantChatHistory = Array.isArray(customer.relevantChatHistory)
        ? customer.relevantChatHistory
        : JSON.parse((customer.relevantChatHistory as string) || "[]");
      
      // Limpiar duplicados consecutivos en el historial relevante
      relevantChatHistory = this.removeDuplicateMessages(relevantChatHistory);
      
      // Limitar el historial relevante a los últimos 20 mensajes
      if (relevantChatHistory.length > 20) {
        relevantChatHistory = relevantChatHistory.slice(-20);
        logger.debug(`Historial relevante limitado a los últimos 20 mensajes (de ${relevantChatHistory.length} total)`);
      }
      
      context.set('fullChatHistory', fullChatHistory);
      context.set('relevantChatHistory', relevantChatHistory);
      
      // Verificar si es una conversación nueva (más de 1 hora desde la última interacción)
      const isNewConversation = customer.lastInteraction && 
        (new Date().getTime() - new Date(customer.lastInteraction).getTime() > 60 * 60 * 1000) ||
        relevantChatHistory.length === 0;
      
      if (isNewConversation && !context.get('isNewCustomer')) {
        context.set('isNewConversation', true);
      }

      return context;
    } catch (error) {
      logger.error('Error in CustomerValidationMiddleware:', error);
      context.setError(error as Error);
      return context;
    }
  }
}