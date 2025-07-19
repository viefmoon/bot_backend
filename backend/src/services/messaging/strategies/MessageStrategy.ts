import { MessageContext } from '../MessageContext';

export abstract class MessageStrategy {
  abstract name: string;
  
  abstract canHandle(context: MessageContext): boolean;
  
  abstract execute(context: MessageContext): Promise<void>;
}