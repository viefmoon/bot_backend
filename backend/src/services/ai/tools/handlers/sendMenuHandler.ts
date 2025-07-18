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
    
  // If menu is too long, split it into parts
  const maxLength = 3500; // Reduced to ensure safety margin for WhatsApp's 4096 limit
  if (menuText.length > maxLength) {
    const parts = MessageSplitter.splitMenu(menuText, maxLength);
    logger.info(`Menu split into ${parts.length} parts, lengths: ${parts.map(p => p.length).join(', ')}`);
    
    // Return multiple responses
    return parts.map((part, index) => ({
      text: part,
      isRelevant: false, // Don't save full menu in relevant history
      sendToWhatsApp: true,
      // For the last message, add history marker
      ...(index === parts.length - 1 && { 
        historyMarker: "MENÚ ENVIADO" 
      })
    }));
  } else {
    logger.info(`Menu fits in one message: ${menuText.length} chars`);
    return {
      text: menuText,
      isRelevant: false,
      sendToWhatsApp: true,
      historyMarker: "MENÚ ENVIADO"
    };
  }
}

/**
 * Handles the send_menu function call for AI tools
 */
export const handleSendMenu: ToolHandler = async (): Promise<ToolResponse | ToolResponse[]> => {
  return getMenuResponses();
};