import { MessagePipeline } from './pipeline/MessagePipeline';
import { IncomingMessage } from './types';
import logger from '../../common/utils/logger';

// Esta clase proporciona una interfaz simple para procesar mensajes de WhatsApp
// a través de nuestro pipeline de procesamiento de mensajes

export class MessageProcessor {
  private static pipeline: MessagePipeline | null = null;
  
  static getPipeline(): MessagePipeline {
    if (!this.pipeline) {
      this.pipeline = new MessagePipeline();
    }
    return this.pipeline;
  }
  
  // Este método procesa los mensajes entrantes a través del pipeline
  static async processWithPipeline(message: any, runId: string): Promise<void> {
    try {
      // Convertir el formato del mensaje al formato del pipeline
      const incomingMessage: IncomingMessage = {
        id: message.id,
        from: message.from,
        type: message.type,
        timestamp: message.timestamp,
        serverTimestamp: message.serverTimestamp,
        text: message.text,
        interactive: message.interactive,
        audio: message.audio
      };
      
      // Procesar con el pipeline con runId
      await this.getPipeline().process(incomingMessage, runId);
    } catch (error) {
      logger.error('Error in MessageProcessor:', error);
      throw error; // Dejar que el llamador maneje el error
    }
  }
}