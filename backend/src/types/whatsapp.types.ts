// Interfaz básica para mensajes de WhatsApp
export interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  text: {
    body: string;
  };
}

// Interfaz para mensajes interactivos
export interface WhatsAppInteractiveMessage {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
  interactive: WhatsAppInteractiveOptions;
}

// Interfaces para las opciones interactivas
export interface WhatsAppInteractiveOptions {
  type: 'button' | 'list';
  header?: {
    type: string;
    text: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: WhatsAppButtonAction | WhatsAppListAction;
}

export interface WhatsAppButtonAction {
  buttons: Array<{
    type: 'reply';
    reply: {
      id: string;
      title: string;
    };
  }>;
}

export interface WhatsAppListAction {
  button: string;
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

// Interfaz para la respuesta de la API
export interface WhatsAppApiResponse {
  messages: [{
    id: string;
  }];
}
