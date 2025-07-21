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
import { Customer } from '@prisma/client';

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

  async process(
    message: IncomingMessage, 
    runId: string,
    customer: Customer,
    fullHistory: any[],
    relevantHistory: any[]
  ): Promise<void> {
    const context = new MessageContext(message, runId);
    
    // Inyectar el contexto pre-cargado
    context.setCustomer(customer);
    context.set(CONTEXT_KEYS.FULL_CHAT_HISTORY, fullHistory);
    context.set(CONTEXT_KEYS.RELEVANT_CHAT_HISTORY, relevantHistory);
    
    try {
      // Ejecutar todos los middlewares
      for (const middleware of this.middlewares) {
        await middleware.process(context);
        
        if (context.shouldStop) {
          break;
        }
      }
      
      // El procesamiento ahora se maneja por middlewares
      
      // Actualizar historial de chat del cliente ANTES de enviar respuestas
      // Esto garantiza que el mensaje del usuario siempre se guarde, incluso si se cancela
      await this.updateChatHistory(context);
      
      // Enviar respuestas (puede cancelarse si el mensaje es obsoleto)
      await this.sendResponses(context);
      
    } catch (error) {
      logger.error('Error in MessagePipeline:', error);
      await this.handleError(context, error as Error);
    }
  }
  
  
  private async sendResponses(context: MessageContext): Promise<void> {
    // POST-PROCESS CANCELLATION CHECK - Using timestamp-based logic
    logger.info(`[DEBUG Post-Process] Checking cancellation for runId ${context.runId} from ${context.message.from}`);
    
    const latestMessageTimestampKey = redisKeys.latestMessageTimestamp(context.message.from);
    const latestCombinedStr = await redisService.get(latestMessageTimestampKey);
    
    if (latestCombinedStr) {
      const [latestWAStr, latestServerStr] = latestCombinedStr.split(':');
      const latestWATimestamp = parseInt(latestWAStr, 10);
      const latestServerTimestamp = latestServerStr ? parseInt(latestServerStr, 10) : 0;
      
      const currentMessage = context.message as any; // Cast to access serverTimestamp
      const currentWATimestamp = parseInt(currentMessage.timestamp, 10);
      const currentServerTimestamp = currentMessage.serverTimestamp || 0;
      
      let shouldCancel = false;
      
      // Compare WhatsApp timestamp first
      if (currentWATimestamp < latestWATimestamp) {
        shouldCancel = true;
      }
      // If equal, compare server timestamp for more precision
      else if (currentWATimestamp === latestWATimestamp && currentServerTimestamp < latestServerTimestamp) {
        shouldCancel = true;
      }
      
      if (shouldCancel) {
        logger.info(`[Cancelled Post-Process] Job ${context.runId} is obsolete. ` +
                    `Current timestamp ${currentWATimestamp}:${currentServerTimestamp} is older than latest ${latestCombinedStr}. ` +
                    `Discarding ${context.unifiedResponses.length} responses.`);
        return; // Stop sending responses
      }
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
    
    // Check if responses were cancelled before adding them to history
    const wasCancelled = await this.wasCancelled(context);
    if (wasCancelled) {
      logger.info(`Skipping history update for assistant responses because job ${context.runId} was cancelled.`);
      return; // No need to update anything if cancelled
    }
    
    // Ya no necesitamos guardar el mensaje del usuario aquí, ya se hizo en el worker.
    // Solo guardamos las respuestas del asistente.
    const fullChatHistory = context.get(CONTEXT_KEYS.FULL_CHAT_HISTORY) || [];
    let relevantChatHistory = context.get(CONTEXT_KEYS.RELEVANT_CHAT_HISTORY) || [];
    
    // Agregar solo las respuestas del asistente al historial
    if (!wasCancelled) {
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
    }
    
    // Limitar el historial relevante a los últimos 20 mensajes antes de guardar
    if (relevantChatHistory.length > 20) {
      relevantChatHistory = relevantChatHistory.slice(-20);
    }
    
    // Actualizar cliente en la base de datos
    await prisma.customer.update({
      where: { id: context.customer.id },
      data: {
        fullChatHistory: fullChatHistory as any,
        relevantChatHistory: relevantChatHistory as any,
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
  
  // Helper method to check if responses were cancelled
  private async wasCancelled(context: MessageContext): Promise<boolean> {
    const latestMessageTimestampKey = redisKeys.latestMessageTimestamp(context.message.from);
    const latestCombinedStr = await redisService.get(latestMessageTimestampKey);
    
    if (!latestCombinedStr) return false;
    
    const [latestWAStr, latestServerStr] = latestCombinedStr.split(':');
    const latestWATimestamp = parseInt(latestWAStr, 10);
    const latestServerTimestamp = latestServerStr ? parseInt(latestServerStr, 10) : 0;
    
    const currentMessage = context.message as any;
    const currentWATimestamp = parseInt(currentMessage.timestamp, 10);
    const currentServerTimestamp = currentMessage.serverTimestamp || 0;
    
    if (currentWATimestamp < latestWATimestamp) return true;
    if (currentWATimestamp === latestWATimestamp && currentServerTimestamp < latestServerTimestamp) return true;
    
    return false;
  }
  
}