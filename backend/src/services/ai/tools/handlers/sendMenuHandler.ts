import { ToolHandler, ToolResponse } from '../types';
import { ProductService } from '../../../products/ProductService';
import { MessageSplitter } from '../../../../common/utils/messageSplitter';

/**
 * Core logic for sending menu - can be used by both AI tools and interactive handlers
 */
export async function getMenuResponses(): Promise<ToolResponse | ToolResponse[]> {
  const menu = await ProductService.getActiveProducts({ formatForWhatsApp: true });
  const menuText = String(menu);
  
  // If menu is too long, split it into parts
  const maxLength = 4000; // Reduced to ensure safety margin for WhatsApp's 4096 limit
  
  if (menuText.length > maxLength) {
    const parts = MessageSplitter.splitMenu(menuText, maxLength);
    
    // Return multiple responses
    return parts.map((part, index) => ({
      text: part,
      isRelevant: false,
      sendToWhatsApp: true,
      ...(index === parts.length - 1 && { 
        historyMarker: "MENÚ ENVIADO" 
      })
    }));
  } else {
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