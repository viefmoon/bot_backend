import { IncomingMessage, MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { RateLimitMiddleware } from '../middlewares/RateLimitMiddleware';
import { CustomerValidationMiddleware } from '../middlewares/CustomerValidationMiddleware';
import { NewCustomerGreetingMiddleware } from '../middlewares/NewCustomerGreetingMiddleware';
import { RestaurantHoursMiddleware } from '../middlewares/RestaurantHoursMiddleware';
import { MessageTypeMiddleware } from '../middlewares/MessageTypeMiddleware';
import { MessageProcessingMiddleware } from '../middlewares/MessageProcessingMiddleware';
import { CONTEXT_KEYS } from '../../../common/constants';
import logger from '../../../common/utils/logger';
import { sendWhatsAppMessage } from '../../whatsapp';
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
  ): Promise<MessageContext> {
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
      
      // Devolver el contexto para que el worker pueda manejar el historial y envío
      return context;
      
    } catch (error) {
      logger.error('Error in MessagePipeline:', error);
      await this.handleError(context, error as Error);
      return context; // Devolver el contexto incluso en caso de error
    }
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