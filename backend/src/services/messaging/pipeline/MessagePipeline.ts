import { IncomingMessage, MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { RateLimitMiddleware } from '../middlewares/RateLimitMiddleware';
import { CustomerValidationMiddleware } from '../middlewares/CustomerValidationMiddleware';
import { MessageTypeMiddleware } from '../middlewares/MessageTypeMiddleware';
import { MessageProcessingMiddleware } from '../middlewares/MessageProcessingMiddleware';
import { prisma } from '../../../server';
import logger from '../../../common/utils/logger';
import { sendWhatsAppMessage } from '../../../common/utils/messageSender';
import { sendWhatsAppInteractiveMessage } from '../../whatsapp';

export class MessagePipeline {
  private middlewares: MessageMiddleware[] = [];
  
  constructor() {
    // Inicializar middlewares en orden
    this.middlewares = [
      new RateLimitMiddleware(),
      new CustomerValidationMiddleware(),
      new MessageTypeMiddleware(),
      new MessageProcessingMiddleware(), // Lógica principal de procesamiento
    ];
  }

  async process(message: IncomingMessage): Promise<void> {
    const context = new MessageContext(message);
    
    try {
      // Ejecutar todos los middlewares
      for (const middleware of this.middlewares) {
        logger.debug(`Running middleware: ${middleware.name}`);
        await middleware.process(context);
        
        if (context.shouldStop) {
          logger.debug(`Pipeline stopped by middleware: ${middleware.name}`);
          break;
        }
      }
      
      // El procesamiento ahora se maneja por middlewares
      
      // Enviar respuestas
      await this.sendResponses(context);
      
      // Actualizar historial de chat del cliente
      await this.updateChatHistory(context);
      
    } catch (error) {
      logger.error('Error in MessagePipeline:', error);
      await this.handleError(context, error as Error);
    }
  }
  
  
  private async sendResponses(context: MessageContext): Promise<void> {
    for (const response of context.responses) {
      if (!response.sendToWhatsApp) continue;
      
      try {
        if (response.text) {
          // La utilidad messageSender se encarga de dividir mensajes largos automáticamente
          await sendWhatsAppMessage(context.message.from, response.text);
        }
        
        if (response.interactiveMessage) {
          const messageId = await sendWhatsAppInteractiveMessage(
            context.message.from, 
            response.interactiveMessage
          );
          
          // Actualizar preOrder con messageId si es necesario
          if (response.preOrderId && messageId) {
            await prisma.preOrder.update({
              where: { id: response.preOrderId },
              data: { messageId }
            });
          }
        }
        
        if (response.confirmationMessage) {
          await sendWhatsAppMessage(context.message.from, response.confirmationMessage);
        }
      } catch (error) {
        logger.error('Error sending response:', error);
      }
    }
  }
  
  private async updateChatHistory(context: MessageContext): Promise<void> {
    if (!context.customer || context.shouldStop) return;
    
    const fullChatHistory = context.get('fullChatHistory') || [];
    const relevantChatHistory = context.get('relevantChatHistory') || [];
    
    // Agregar mensaje del usuario al historial
    fullChatHistory.push({
      role: 'user',
      content: context.message.text?.body || '[Non-text message]',
      timestamp: new Date()
    });
    
    // Agregar al historial relevante si no es una conversación nueva
    if (!context.get('isNewConversation')) {
      relevantChatHistory.push({
        role: 'user',
        content: context.message.text?.body || '[Non-text message]',
        timestamp: new Date()
      });
    }
    
    // Agregar respuestas al historial
    for (const response of context.responses) {
      if (response.text) {
        fullChatHistory.push({
          role: 'assistant',
          content: response.text,
          timestamp: new Date()
        });
        
        if (response.isRelevant) {
          relevantChatHistory.push({
            role: 'assistant',
            content: response.text,
            timestamp: new Date()
          });
        }
      }
    }
    
    // Actualizar cliente en la base de datos
    await prisma.customer.update({
      where: { customerId: context.customer.customerId },
      data: {
        fullChatHistory: JSON.stringify(fullChatHistory),
        relevantChatHistory: JSON.stringify(relevantChatHistory),
        lastInteraction: new Date()
      }
    });
  }
  
  private async handleError(context: MessageContext, error: Error): Promise<void> {
    logger.error('Pipeline error:', error);
    
    try {
      await sendWhatsAppMessage(
        context.message.from,
        'Lo siento, ocurrió un error procesando tu mensaje. Por favor intenta de nuevo.'
      );
    } catch (sendError) {
      logger.error('Error sending error message:', sendError);
    }
  }
  
  // Método para agregar middlewares personalizados
  addMiddleware(middleware: MessageMiddleware, index?: number): void {
    if (index !== undefined) {
      this.middlewares.splice(index, 0, middleware);
    } else {
      this.middlewares.push(middleware);
    }
  }
  
}