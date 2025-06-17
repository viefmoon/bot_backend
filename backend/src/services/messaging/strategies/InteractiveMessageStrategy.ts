import { MessageStrategy } from './MessageStrategy';
import { MessageContext } from '../MessageContext';
import { handleInteractiveMessage } from '../../../whatsapp/handlers/interactiveMessageHandler';
import logger from '../../../common/utils/logger';

export class InteractiveMessageStrategy extends MessageStrategy {
  name = 'InteractiveMessageStrategy';
  
  canHandle(context: MessageContext): boolean {
    return context.message.type === 'interactive';
  }
  
  async execute(context: MessageContext): Promise<void> {
    try {
      // Delegar al manejador de mensajes interactivos existente
      await handleInteractiveMessage(context.message.from, context.message);
      
      // Detener procesamiento adicional ya que los mensajes interactivos se manejan completamente
      context.stop();
    } catch (error) {
      logger.error('Error handling interactive message:', error);
      // El manejo de errores ya se hace en handleInteractiveMessage
      context.stop();
    }
  }
}