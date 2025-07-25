import { MessagePipeline } from './pipeline/MessagePipeline';
import { IncomingMessage } from './types';
import logger from '../../common/utils/logger';
import { Customer } from '@prisma/client';
import { MessageContext } from './MessageContext';


export class MessageProcessor {
  private static pipeline: MessagePipeline | null = null;
  
  static getPipeline(): MessagePipeline {
    if (!this.pipeline) {
      this.pipeline = new MessagePipeline();
    }
    return this.pipeline;
  }
  
  static async processWithPipeline(
    message: any, 
    runId: string,
    customer: Customer,
    fullHistory: any[],
    relevantHistory: any[]
  ): Promise<MessageContext> {
    try {
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
      
      return await this.getPipeline().process(
        incomingMessage, 
        runId,
        customer,
        fullHistory,
        relevantHistory
      );
    } catch (error) {
      logger.error('Error in MessageProcessor:', error);
      throw error;
    }
  }
}