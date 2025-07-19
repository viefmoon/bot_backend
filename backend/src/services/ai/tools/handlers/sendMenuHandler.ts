import { ToolHandler } from '../types';
import { ProductService } from '../../../products/ProductService';
import { MessageSplitter } from '../../../../common/utils/messageSplitter';
import { UnifiedResponse, ResponseBuilder, ResponseType } from '../../../messaging/types/responses';

/**
 * Core logic for sending menu - can be used by both AI tools and interactive handlers
 */
export async function getMenuResponses(): Promise<UnifiedResponse | UnifiedResponse[]> {
  const menuText = await ProductService.getMenuForWhatsApp();
  
  // If menu is too long, split it into parts
  const maxLength = 4000; // Reduced to ensure safety margin for WhatsApp's 4096 limit
  
  if (menuText.length > maxLength) {
    const parts = MessageSplitter.splitMenu(menuText, maxLength);
    
    // Return multiple responses
    return parts.map((part, index) => {
      if (index === parts.length - 1) {
        // Last part gets the history marker
        return ResponseBuilder.textWithHistoryMarker(
          part,
          "[ACCIÓN DEL BOT]: Envió el menú completo del restaurante.",
          ResponseType.MENU_INFO
        );
      } else {
        // Other parts are not relevant for history
        const response = ResponseBuilder.text(part, false);
        response.metadata.type = ResponseType.MENU_INFO;
        return response;
      }
    });
  } else {
    return ResponseBuilder.textWithHistoryMarker(
      menuText,
      "[ACCIÓN DEL BOT]: Envió el menú completo del restaurante.",
      ResponseType.MENU_INFO
    );
  }
}

/**
 * Handles the send_menu function call for AI tools
 */
export const handleSendMenu: ToolHandler = async (): Promise<UnifiedResponse | UnifiedResponse[]> => {
  return getMenuResponses();
};