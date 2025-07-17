import { ToolHandler, ToolResponse } from '../types';
import { ProductService } from '../../../products/ProductService';
import { MessageSplitter } from '../../../../common/utils/messageSplitter';
import logger from '../../../../common/utils/logger';

/**
 * Handles the send_menu function call
 * Retrieves and sends the restaurant menu
 */
export const handleSendMenu: ToolHandler = async (): Promise<ToolResponse | ToolResponse[]> => {
  const menu = await ProductService.getActiveProducts({ formatForAI: true });
  const menuText = String(menu);
  
  // If menu is too long, split it into parts
  const maxLength = 4000; // Leave margin for WhatsApp
  if (menuText.length > maxLength) {
    const parts = MessageSplitter.splitMenu(menuText, maxLength);
    logger.debug(`Menu split into ${parts.length} parts`);
    
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
    return {
      text: menuText,
      isRelevant: false,
      sendToWhatsApp: true,
      historyMarker: "MENÚ ENVIADO"
    };
  }
};