import { MessageStrategy } from './MessageStrategy';
import { MessageContext } from '../MessageContext';
import { TextProcessingService } from '../TextProcessingService';
import { ResponseBuilder, ResponseType } from '../types/responses';
import logger from '../../../common/utils/logger';

export class TextMessageStrategy extends MessageStrategy {
  name = 'TextMessageStrategy';
  
  canHandle(context: MessageContext): boolean {
    return context.message.type === 'text';
  }
  
  async execute(context: MessageContext): Promise<void> {
    if (!context.message.text?.body || !context.customer) return;
    
    const text = context.message.text.body;
    
    try {
      // Delegate text processing to the shared service
      await TextProcessingService.processTextMessage(text, context);
    } catch (error) {
      logger.error("Error in TextMessageStrategy:", error);
      
      // Use UnifiedResponse for error handling
      const errorResponse = ResponseBuilder.error(
        'PROCESSING_ERROR',
        "Error al procesar la solicitud: " + (error as Error).message
      );
      context.addUnifiedResponse(errorResponse);
    }
  }
}