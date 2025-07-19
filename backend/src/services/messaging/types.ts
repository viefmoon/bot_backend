import { Customer } from '@prisma/client';
import { IncomingMessage } from '../../common/types/whatsapp-messages.types';
import { UnifiedResponse } from './types/responses';

export * from './types/responses';

// Re-exportar tipos de WhatsApp desde la ubicación centralizada
export { IncomingMessage };

export interface MessageContext {
  message: IncomingMessage;
  customer?: Customer;
  chatHistory?: any[];
  metadata: Map<string, any>;
  shouldStop: boolean;
  error?: Error;
}

export interface MessageMiddleware {
  name: string;
  process(context: MessageContext): Promise<MessageContext>;
}

export interface MessageStrategy {
  execute(message: IncomingMessage, customer: Customer): Promise<UnifiedResponse[]>;
}