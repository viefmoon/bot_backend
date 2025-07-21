export interface WhatsAppMessageJob {
  id: string;
  from: string;
  type: string;
  timestamp: string;
  serverTimestamp?: number; // Server reception timestamp in milliseconds
  text?: any;
  interactive?: any;
  audio?: any;
}