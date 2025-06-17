import { Customer } from '@prisma/client';

export * from './types/responses';

export interface IncomingMessage {
  id: string;
  from: string;
  type: 'text' | 'interactive' | 'audio' | 'image' | 'document' | 'location';
  timestamp: string;
  text?: {
    body: string;
  };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  audio?: {
    id: string;
    mime_type: string;
  };
}

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
}

export interface MessageMiddleware {
  name: string;
  process(context: MessageContext): Promise<MessageContext>;
}

export interface MessageStrategy {
  execute(message: IncomingMessage, customer: Customer): Promise<MessageResponse[]>;
}