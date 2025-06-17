/**
 * Central export file for WhatsApp functionality
 * Re-exports commonly used functions for easier imports
 */

// Re-export from WhatsAppService
export { 
  WhatsAppService,
  WhatsAppService as default 
} from './WhatsAppService';

// Re-export specific WhatsApp functions
import { WhatsAppService } from './WhatsAppService';

export const sendWhatsAppMessage = WhatsAppService.sendWhatsAppMessage.bind(WhatsAppService);
export const sendWhatsAppInteractiveMessage = WhatsAppService.sendInteractiveMessage.bind(WhatsAppService);
export const getWhatsAppMediaUrl = WhatsAppService.getMediaUrl.bind(WhatsAppService);
export const downloadWhatsAppMedia = WhatsAppService.downloadMedia.bind(WhatsAppService);
export const verifyWhatsAppWebhook = WhatsAppService.verifyWebhook.bind(WhatsAppService);
export const handleWhatsAppWebhook = WhatsAppService.handleWebhook.bind(WhatsAppService);