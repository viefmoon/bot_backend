import { Customer } from '@prisma/client';
import { IncomingMessage } from '../../common/types/whatsapp-messages.types';

export * from './types/responses';

// Re-exportar tipos de WhatsApp desde la ubicación centralizada
export { IncomingMessage };

export interface MessageContext {
  message: IncomingMessage;
  customer?: Customer;
  chatHistory?: any[];
  response?: MessageResponse;
  metadata: Map<string, any>;
  shouldStop: boolean;
  error?: Error;
}

export interface MessageResponse {
  text?: string;
  interactiveMessage?: any;
  sendToWhatsApp: boolean;
  isRelevant: boolean;
  preOrderId?: number;
  confirmationMessage?: string;
  historyMarker?: string; // Texto alternativo para guardar en el historial
}

export interface MessageMiddleware {
  name: string;
  process(context: MessageContext): Promise<MessageContext>;
}

export interface MessageStrategy {
  execute(message: IncomingMessage, customer: Customer): Promise<MessageResponse[]>;
}