export interface WhatsAppMessage {
    from: string;
    type: string;
    id: string;
    text?: { body: string };
    timestamp: string;
  }
  
  export interface WebhookEntry {
    changes: Array<{
      value: {
        messages?: WhatsAppMessage[];
      };
    }>;
  }
  
  export interface WebhookBody {
    object: string;
    entry: WebhookEntry[];
  }