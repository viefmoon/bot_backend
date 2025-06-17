import { MessageContext } from '../MessageContext';
import { MessageResponse } from '../types';

export abstract class MessageStrategy {
  abstract name: string;
  
  abstract canHandle(context: MessageContext): boolean;
  
  abstract execute(context: MessageContext): Promise<void>;
  
  protected addResponse(context: MessageContext, response: MessageResponse): void {
    context.addResponse(response);
  }
}