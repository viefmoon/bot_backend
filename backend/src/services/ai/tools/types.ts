import { MessageContext } from '../../messaging/MessageContext';

/**
 * Base type for all tool handler functions
 */
export type ToolHandler = (args: any, context?: MessageContext) => Promise<any | null>;

/**
 * Response types that tool handlers can return
 */
export interface ToolResponse {
  text?: string;
  isRelevant?: boolean;
  sendToWhatsApp?: boolean;
  historyMarker?: string;
  urlButton?: {
    title: string;
    body: string;
    buttonText: string;
    url: string;
  };
  preprocessedContent?: any;
  confirmationMessage?: string;
}