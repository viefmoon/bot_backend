// Interfaz para mensajes salientes de WhatsApp
export interface OutgoingWhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  text: { body: string };
}

// Interfaz para el contenido interactivo
export interface WhatsAppInteractiveContent {
  header?: {
    type: string;
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
    buttons?: Array<{
      type: string;
      reply: {
        id: string;
        title: string;
      };
    }>;
    sections?: Array<{
      title?: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
}

// Interfaz para mensajes interactivos salientes
export interface OutgoingWhatsAppInteractiveMessage {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
  interactive: WhatsAppInteractiveContent;
}

// Interfaz para la respuesta de la API
export interface WhatsAppApiResponse {
  messages: [{
    id: string;
  }];
}
