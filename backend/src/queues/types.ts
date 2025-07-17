export interface WhatsAppMessageJob {
  id: string;
  from: string;
  type: string;
  timestamp: string;
  text?: any;
  interactive?: any;
  audio?: any;
}