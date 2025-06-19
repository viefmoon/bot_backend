import { IncomingMessage, MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { RateLimitMiddleware } from '../middlewares/RateLimitMiddleware';
import { CustomerValidationMiddleware } from '../middlewares/CustomerValidationMiddleware';
import { RestaurantHoursMiddleware } from '../middlewares/RestaurantHoursMiddleware';
import { AddressRequiredMiddleware } from '../middlewares/AddressRequiredMiddleware';
import { MessageTypeMiddleware } from '../middlewares/MessageTypeMiddleware';
import { MessageProcessingMiddleware } from '../middlewares/MessageProcessingMiddleware';
import { prisma } from '../../../server';
import logger from '../../../common/utils/logger';
import { sendWhatsAppMessage, sendWhatsAppInteractiveMessage } from '../../whatsapp';

export class MessagePipeline {
  private middlewares: MessageMiddleware[] = [];
  
  constructor() {
    // Inicializar middlewares en orden
    this.middlewares = [
      new RateLimitMiddleware(),
      new CustomerValidationMiddleware(),
      new RestaurantHoursMiddleware(), // Verifica horarios antes de cualquier procesamiento
      new AddressRequiredMiddleware(), // Bloquea si no hay dirección
      new MessageTypeMiddleware(),
      new MessageProcessingMiddleware(), // Lógica principal de procesamiento
    ];
  }

  async process(message: IncomingMessage): Promise<void> {
    const context = new MessageContext(message);
    
    try {
      // Ejecutar todos los middlewares
      for (const middleware of this.middlewares) {
        await middleware.process(context);
        
        if (context.shouldStop) {
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
            logger.info(`Updating pre-order ${response.preOrderId} with WhatsApp messageId: ${messageId}`);
            await prisma.preOrder.update({
              where: { id: response.preOrderId },
              data: { messageId }
            });
            logger.info(`Pre-order ${response.preOrderId} updated successfully with messageId`);
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
    
    // Si se marca skipHistoryUpdate, no guardar nada en el historial
    if (context.get('skipHistoryUpdate')) {
      logger.debug('Skipping history update due to skipHistoryUpdate flag');
      return;
    }
    
    const fullChatHistory = context.get('fullChatHistory') || [];
    const relevantChatHistory = context.get('relevantChatHistory') || [];
    
    // Agregar mensaje del usuario al historial
    fullChatHistory.push({
      role: 'user',
      content: context.message.text?.body || '[Non-text message]',
      timestamp: new Date()
    });
    
    // Siempre agregar al historial relevante
    relevantChatHistory.push({
      role: 'user',
      content: context.message.text?.body || '[Non-text message]',
      timestamp: new Date()
    });
    
    // Agregar respuestas al historial
    for (const response of context.responses) {
      if (response.text || response.historyMarker) {
        // Para el historial completo, siempre usar el texto completo
        if (response.text) {
          fullChatHistory.push({
            role: 'assistant',
            content: response.text,
            timestamp: new Date()
          });
        }
        
        // Para el historial relevante
        if (response.isRelevant || response.historyMarker) {
          // Si hay marcador, usarlo siempre. Si no, usar el texto solo si es relevante
          const contentToSave = response.historyMarker || (response.isRelevant ? response.text : null);
          if (contentToSave) {
            relevantChatHistory.push({
              role: 'assistant',
              content: contentToSave,
              timestamp: new Date()
            });
          }
        }
      }
    }
    
    // Limitar el historial relevante a los últimos 20 mensajes antes de guardar
    if (relevantChatHistory.length > 20) {
      relevantChatHistory = relevantChatHistory.slice(-20);
    }
    
    // Actualizar cliente en la base de datos
    await prisma.customer.update({
      where: { id: context.customer.id },
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