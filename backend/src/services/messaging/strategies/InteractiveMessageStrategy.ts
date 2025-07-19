import { MessageStrategy } from './MessageStrategy';
import { MessageContext } from '../MessageContext';
import { findHandler } from '../../../whatsapp/handlers/interactive';
import { ResponseBuilder, UnifiedResponse } from '../types/responses';
import logger from '../../../common/utils/logger';

export class InteractiveMessageStrategy extends MessageStrategy {
  name = 'InteractiveMessageStrategy';
  
  canHandle(context: MessageContext): boolean {
    return context.message.type === 'interactive';
  }
  
  async execute(context: MessageContext): Promise<void> {
    try {
      const interactive = context.message.interactive;
      if (!interactive) return;

      const reply = interactive.button_reply || interactive.list_reply;
      if (!reply) return;

      const { id, title } = reply;
      logger.info(`Processing interactive reply: ${id} ("${title}")`);

      // 1. Registrar la ACCIÓN DEL USUARIO en el historial como un marcador interno.
      //    Esto no se envía al usuario, solo se guarda.
      const userActionMarker = ResponseBuilder.internalMarker(
        `[ACCIÓN DEL USUARIO]: Seleccionó la opción "${title}"`
      );
      context.addUnifiedResponse(userActionMarker);

      // 2. Encontrar y ejecutar el manejador correspondiente.
      const handler = findHandler(id);
      
      if (handler) {
        logger.info(`Executing handler for action: ${id}`);
        // El manejador ahora devuelve una o más UnifiedResponse.
        const responses = await handler(context.message.from, id);
        
        if (responses) {
          // Añadir las respuestas del bot al contexto para que el pipeline las envíe.
          if (Array.isArray(responses)) {
            responses.forEach(res => context.addUnifiedResponse(res));
          } else {
            context.addUnifiedResponse(responses as UnifiedResponse);
          }
        }
      } else {
        logger.warn(`No handler found for interactive action: ${id}`);
        context.addUnifiedResponse(
          ResponseBuilder.error('HANDLER_NOT_FOUND', 'Acción no reconocida.')
        );
      }
      
      // 3. MUY IMPORTANTE: Ya NO detenemos el pipeline.
      //    Al no llamar a context.stop(), permitimos que el pipeline continúe
      //    hacia las fases de envío de respuestas y actualización de historial.

    } catch (error) {
      logger.error('Error handling interactive message:', error);
      context.setError(error as Error);
    }
  }
}