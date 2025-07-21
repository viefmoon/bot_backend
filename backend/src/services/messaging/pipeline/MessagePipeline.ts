import { IncomingMessage, MessageMiddleware, UnifiedResponse } from '../types';
import { MessageContext } from '../MessageContext';
import { RateLimitMiddleware } from '../middlewares/RateLimitMiddleware';
import { CustomerValidationMiddleware } from '../middlewares/CustomerValidationMiddleware';
import { NewCustomerGreetingMiddleware } from '../middlewares/NewCustomerGreetingMiddleware';
import { RestaurantHoursMiddleware } from '../middlewares/RestaurantHoursMiddleware';
import { MessageTypeMiddleware } from '../middlewares/MessageTypeMiddleware';
import { MessageProcessingMiddleware } from '../middlewares/MessageProcessingMiddleware';
import { prisma } from '../../../lib/prisma';
import { CONTEXT_KEYS } from '../../../common/constants';
import logger from '../../../common/utils/logger';
import { sendWhatsAppMessage, sendWhatsAppInteractiveMessage, sendMessageWithUrlButton } from '../../whatsapp';
import { SyncMetadataService } from '../../../services/sync/SyncMetadataService';
import { redisService } from '../../redis/RedisService';
import { redisKeys } from '../../../common/constants';

export class MessagePipeline {
  private middlewares: MessageMiddleware[] = [];
  
  constructor() {
    // Inicializar middlewares en orden
    this.middlewares = [
      new RateLimitMiddleware(),
      new CustomerValidationMiddleware(),
      new NewCustomerGreetingMiddleware(), // Intercepta clientes nuevos antes de cualquier procesamiento
      new RestaurantHoursMiddleware(), // Verifica horarios antes de cualquier procesamiento
      new MessageTypeMiddleware(),
      new MessageProcessingMiddleware(), // Lógica principal de procesamiento
    ];
  }

  async process(message: IncomingMessage, runId: string): Promise<void> {
    const context = new MessageContext(message, runId);
    
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
    // POST-PROCESS CANCELLATION CHECK
    logger.info(`[DEBUG Post-Process] Checking cancellation for runId ${context.runId} from ${context.message.from}`);
    
    const currentRunKey = redisKeys.currentRun(context.message.from);
    const activeRunId = await redisService.get(currentRunKey);
    
    logger.info(`[DEBUG Post-Process] Active runId from Redis: ${activeRunId || 'NULL'}, Current runId: ${context.runId}`);
    
    // Check if this context's runId is still the active one in Redis
    if (activeRunId && activeRunId !== context.runId) {
      logger.info(`[DEBUG Post-Process] CANCELLING: ${context.runId} !== ${activeRunId}`);
      logger.info(`[Cancelled Post-Process] Run ${context.runId} is obsolete. Active run is ${activeRunId}. Discarding ${context.unifiedResponses.length} responses.`);
      // A newer job has taken control. Don't send anything.
      return;
    }
    
    // If we get here, we have permission to send the responses
    // Enviar solo las respuestas que deben enviarse
    for (const response of context.unifiedResponses) {
      if (!response.metadata.shouldSend) continue;
      
      try {
        // Enviar botón con URL si existe
        if (response.content?.urlButton) {
          const { title, body, buttonText, url } = response.content.urlButton;
          await sendMessageWithUrlButton(
            context.message.from,
            title,
            body,
            buttonText,
            url
          );
        }
        // Enviar texto si existe
        else if (response.content?.text) {
          // La utilidad messageSender se encarga de dividir mensajes largos automáticamente
          await sendWhatsAppMessage(context.message.from, response.content.text);
        }
        // Enviar mensaje interactivo si existe
        else if (response.content?.interactive) {
          await sendWhatsAppInteractiveMessage(
            context.message.from, 
            response.content.interactive
          );
        }
      } catch (error) {
        logger.error('Error sending response:', error);
      }
    }
  }
  
  private async updateChatHistory(context: MessageContext): Promise<void> {
    if (!context.customer || context.shouldStop) return;
    
    // Si se marca skipHistoryUpdate, no guardar nada en el historial
    if (context.get(CONTEXT_KEYS.SKIP_HISTORY_UPDATE)) {
      logger.debug('Skipping history update due to skipHistoryUpdate flag');
      return;
    }
    
    const fullChatHistory = context.get(CONTEXT_KEYS.FULL_CHAT_HISTORY) || [];
    let relevantChatHistory = context.get(CONTEXT_KEYS.RELEVANT_CHAT_HISTORY) || [];
    
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
    
    // Agregar respuestas al historial usando la lógica unificada
    for (const response of context.unifiedResponses) {
      const textContent = response.content?.text;
      const historyMarker = response.metadata.historyMarker;
      const isRelevant = response.metadata.isRelevant;
      
      // Para el historial completo, siempre usar el texto completo si existe
      if (textContent) {
        fullChatHistory.push({
          role: 'assistant',
          content: textContent,
          timestamp: new Date()
        });
      }
      
      // Para el historial relevante, aplicar las reglas de prioridad:
      // 1. Si hay historyMarker, usarlo siempre
      // 2. Si no hay historyMarker pero isRelevant es true, usar el texto
      // 3. Si isRelevant es false y no hay historyMarker, no guardar
      if (historyMarker || (isRelevant && textContent)) {
        const contentToSave = historyMarker || textContent;
        relevantChatHistory.push({
          role: 'assistant',
          content: contentToSave!,
          timestamp: new Date()
        });
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
    
    // Mark for sync
    await SyncMetadataService.markForSync('Customer', context.customer.id, 'REMOTE');
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