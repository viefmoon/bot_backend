// Interfaz para mensajes entrantes de WhatsApp (desde webhook)
export interface IncomingWhatsAppMessage {
    from: string;
    type: string;
    id: string;
    text?: { body: string };
    timestamp: string;
    interactive?: {
      type: string;
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
  
  export interface WebhookEntry {
    changes: Array<{
      value: {
        messages?: IncomingWhatsAppMessage[];
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