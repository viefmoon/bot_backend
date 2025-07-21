/**
 * Tipos consolidados para mensajes de WhatsApp
 * Este archivo unifica todas las definiciones de tipos relacionadas con WhatsApp
 */

// Tipos de mensajes entrantes
export interface IncomingMessage {
  id: string;
  from: string;
  type: 'text' | 'interactive' | 'audio' | 'image' | 'document' | 'location';
  timestamp: string;
  serverTimestamp?: number; // Timestamp del servidor para desempatar mensajes concurrentes
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

// Estructura del webhook de WhatsApp
export interface WebhookEntry {
  changes: Array<{
    value: {
      messages?: IncomingMessage[];
      messaging_product?: string;
      metadata?: {
        display_phone_number: string;
        phone_number_id: string;
      };
    };
  }>;
}

export interface WebhookBody {
  object: string;
  entry: WebhookEntry[];
}

// Tipos de mensajes salientes
export interface OutgoingTextMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string };
}

export interface InteractiveButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface InteractiveSection {
  title?: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export interface InteractiveContent {
  header?: {
    type: 'text' | 'image';
    text?: string;
    image?: {
      link: string;
    };
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    button?: string;
    buttons?: InteractiveButton[];
    sections?: InteractiveSection[];
  };
}

export interface OutgoingInteractiveMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: InteractiveContent;
}

// Union type para cualquier mensaje saliente
export type OutgoingMessage = OutgoingTextMessage | OutgoingInteractiveMessage;

// Respuesta de la API de WhatsApp
export interface WhatsAppApiResponse {
  messages: [{
    id: string;
  }];
}