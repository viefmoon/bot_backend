import { ToolHandler, ToolResponse } from '../types';
import { ProductService } from '../../../products/ProductService';
import { MessageSplitter } from '../../../../common/utils/messageSplitter';
import logger from '../../../../common/utils/logger';

/**
 * Core logic for sending menu - can be used by both AI tools and interactive handlers
 */
export async function getMenuResponses(): Promise<ToolResponse | ToolResponse[]> {
  // Use WhatsApp format for customers
  const menu = await ProductService.getActiveProducts({ formatForWhatsApp: true });
  const menuText = String(menu);
    
  logger.info(`Menu total length: ${menuText.length} characters`);
  
  // Always use MessageSplitter to ensure proper division
  const maxLength = 3000; // Conservative limit to ensure it fits in WhatsApp
  const parts = MessageSplitter.splitMenu(menuText, maxLength);
  
  logger.info(`Menu split into ${parts.length} parts, lengths: ${parts.map(p => p.length).join(', ')}`);
  
  if (parts.length === 1) {
    // Single message
    return {
      text: parts[0],
      isRelevant: false,
      sendToWhatsApp: true,
      historyMarker: "MENÚ ENVIADO"
    };
  } else {
    // Multiple messages
    return parts.map((part, index) => ({
      text: part,
      isRelevant: false,
      sendToWhatsApp: true,
      // For the last message, add history marker
      ...(index === parts.length - 1 && { 
        historyMarker: "MENÚ ENVIADO" 
      })
    }));
  }
}

/**
 * Handles the send_menu function call for AI tools
 */
export const handleSendMenu: ToolHandler = async (): Promise<ToolResponse | ToolResponse[]> => {
  return getMenuResponses();
};