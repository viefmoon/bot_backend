/**
 * Utilidad para enviar mensajes de WhatsApp manejando automáticamente
 * la división de mensajes largos
 */

import { WhatsAppService } from '../../services/communication/WhatsAppService';
import logger from './logger';
import { ExternalServiceError, ErrorCode } from '../services/errors';

const MAX_MESSAGE_LENGTH = 4000; // Dejamos margen para WhatsApp

/**
 * Envía un mensaje de WhatsApp, dividiéndolo automáticamente si es muy largo
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    if (message.length <= MAX_MESSAGE_LENGTH) {
      const result = await WhatsAppService.sendMessage(to, message);
      if (!result.success) {
        throw new ExternalServiceError(
          ErrorCode.WHATSAPP_ERROR,
          result.error || 'Failed to send message',
          { metadata: { to, messageLength: message.length } }
        );
      }
      return true;
    }
    
    // Dividir mensaje largo
    const parts = splitLongMessage(message, MAX_MESSAGE_LENGTH);
    logger.debug(`Mensaje dividido en ${parts.length} partes`);
    
    // Enviar cada parte
    for (const part of parts) {
      const result = await WhatsAppService.sendMessage(to, part);
      if (!result.success) {
        throw new ExternalServiceError(
          ErrorCode.WHATSAPP_ERROR,
          result.error || 'Failed to send message part',
          { metadata: { to, partLength: part.length } }
        );
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error enviando mensaje de WhatsApp:', error);
    return false;
  }
}

/**
 * Divide un mensaje largo en partes respetando líneas y palabras
 */
function splitLongMessage(text: string, maxLength: number): string[] {
  const parts: string[] = [];
  const lines = text.split('\n');
  let currentPart = '';
  
  for (const line of lines) {
    // Si agregar esta línea excede el límite
    if (currentPart.length + line.length + 1 > maxLength) {
      // Si la línea sola es muy larga, dividirla por palabras
      if (line.length > maxLength) {
        if (currentPart.trim()) {
          parts.push(currentPart.trim());
          currentPart = '';
        }
        
        const words = line.split(' ');
        let tempLine = '';
        
        for (const word of words) {
          if (tempLine.length + word.length + 1 <= maxLength) {
            tempLine += (tempLine ? ' ' : '') + word;
          } else {
            if (tempLine) parts.push(tempLine);
            tempLine = word;
          }
        }
        if (tempLine) currentPart = tempLine + '\n';
      } else {
        // Guardar la parte actual y empezar una nueva
        if (currentPart.trim()) {
          parts.push(currentPart.trim());
        }
        currentPart = line + '\n';
      }
    } else {
      // Agregar línea a la parte actual
      currentPart += line + '\n';
    }
  }
  
  // Agregar cualquier contenido restante
  if (currentPart.trim()) {
    parts.push(currentPart.trim());
  }
  
  return parts;
}