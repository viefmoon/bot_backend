import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { sendWhatsAppMessage, sendWhatsAppInteractiveMessage } from '../../whatsapp';
import { WELCOME_MESSAGE_INTERACTIVE, UNSUPPORTED_MESSAGE_TYPE } from '../../../common/config/predefinedMessages';
import logger from '../../../common/utils/logger';
import { prisma } from '../../../server';

export class MessageTypeMiddleware implements MessageMiddleware {
  name = 'MessageTypeMiddleware';

  async process(context: MessageContext): Promise<MessageContext> {
    try {
      // Verificar si es un cliente nuevo o conversación nueva que necesita mensaje de bienvenida
      if (context.get('isNewCustomer') || context.get('isNewConversation')) {
        const welcomeMessage = await WELCOME_MESSAGE_INTERACTIVE();
        await sendWhatsAppInteractiveMessage(context.message.from, welcomeMessage);
        
        // Limpiar el historial relevante para conversaciones nuevas
        if (context.get('isNewConversation')) {
          context.set('relevantChatHistory', []);
        }
      }
      
      // Manejar frases de reinicio
      if (context.message.type === 'text' && context.message.text?.body) {
        const text = context.message.text.body;
        const restartPhrases = [
          "olvida lo anterior",
          "reinicia la conversación",
          "borra el historial",
          "empecemos de nuevo",
          "olvida todo",
          "reinicia el chat",
        ];
        
        if (restartPhrases.some(phrase => text.toLowerCase().includes(phrase))) {
          await this.handleConversationReset(context);
          return context;
        }
      }
      
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
  
  private async handleConversationReset(context: MessageContext): Promise<void> {
    // Reiniciar historial de chat
    await prisma.customer.update({
      where: { customerId: context.message.from },
      data: { relevantChatHistory: [] }
    });
    
    await sendWhatsAppMessage(
      context.message.from,
      "🔄 Entendido, he olvidado el contexto anterior. ¿En qué puedo ayudarte ahora? 😊"
    );
    
    context.stop(); // Detener procesamiento porque ya manejamos el reinicio
  }
}