import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { MessageStrategy } from '../strategies/MessageStrategy';
import { TextMessageStrategy } from '../strategies/TextMessageStrategy';
import { InteractiveMessageStrategy } from '../strategies/InteractiveMessageStrategy';
import { AudioMessageStrategy } from '../strategies/AudioMessageStrategy';
import logger from '../../../common/utils/logger';

export class MessageProcessingMiddleware implements MessageMiddleware {
  name = 'MessageProcessingMiddleware';
  
  private strategies: MessageStrategy[] = [
    new AudioMessageStrategy(),      // Audio primero para convertir a texto
    new InteractiveMessageStrategy(), // Mensajes interactivos
    new TextMessageStrategy(),        // Mensajes de texto
  ];
  
  async process(context: MessageContext): Promise<MessageContext> {
    try {
      // Encontrar la estrategia apropiada
      for (const strategy of this.strategies) {
        if (strategy.canHandle(context)) {
          logger.debug(`Processing message with strategy: ${strategy.name}`);
          await strategy.execute(context);
          
          // Si el audio se convirtió a texto, continuar procesando
          if (strategy.name === 'AudioMessageStrategy' && context.message.type === 'text') {
            continue;
          }
          
          break;
        }
      }
      
      return context;
    } catch (error) {
      logger.error('Error in MessageProcessingMiddleware:', error);
      context.setError(error as Error);
      return context;
    }
  }
}