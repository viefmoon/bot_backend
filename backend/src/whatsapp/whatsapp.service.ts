import { Injectable } from '@nestjs/common';
import { 
  sendWhatsAppMessage, 
  sendWhatsAppInteractiveMessage,
  sendWelcomeMessage 
} from './utils/whatsapp.utils';
import { WhatsAppInteractiveContent } from '../common/types/whatsapp.types';
import logger from '../common/utils/logger';

@Injectable()
export class WhatsAppService {
  /**
   * Envía un mensaje de texto simple por WhatsApp
   * @param phoneNumber Número de teléfono del destinatario
   * @param message Mensaje a enviar
   * @returns Array de IDs de mensajes enviados o null si hay error
   */
  async sendMessage(phoneNumber: string, message: string): Promise<string[] | null> {
    try {
      if (!phoneNumber || !message) {
        logger.error('WhatsApp Service: phoneNumber and message are required');
        return null;
      }

      const result = await sendWhatsAppMessage(phoneNumber, message);
      
      if (result) {
        logger.info(`WhatsApp message sent successfully to ${phoneNumber}`);
      }
      
      return result;
    } catch (error) {
      logger.error('Error in WhatsApp service sendMessage:', error);
      return null;
    }
  }

  /**
   * Envía un mensaje interactivo por WhatsApp
   * @param phoneNumber Número de teléfono del destinatario
   * @param interactiveOptions Opciones del mensaje interactivo
   * @returns ID del mensaje enviado o null si hay error
   */
  async sendInteractiveMessage(
    phoneNumber: string,
    interactiveOptions: WhatsAppInteractiveContent
  ): Promise<string | null> {
    try {
      if (!phoneNumber || !interactiveOptions) {
        logger.error('WhatsApp Service: phoneNumber and interactiveOptions are required');
        return null;
      }

      const result = await sendWhatsAppInteractiveMessage(phoneNumber, interactiveOptions);
      
      if (result) {
        logger.info(`WhatsApp interactive message sent successfully to ${phoneNumber}`);
      }
      
      return result;
    } catch (error) {
      logger.error('Error in WhatsApp service sendInteractiveMessage:', error);
      return null;
    }
  }

  /**
   * Envía un mensaje de bienvenida
   * @param phoneNumber Número de teléfono del destinatario
   */
  async sendWelcomeMessage(phoneNumber: string): Promise<void> {
    try {
      if (!phoneNumber) {
        logger.error('WhatsApp Service: phoneNumber is required for welcome message');
        return;
      }

      await sendWelcomeMessage(phoneNumber);
      logger.info(`Welcome message sent to ${phoneNumber}`);
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  }

  /**
   * Valida si un número de teléfono tiene el formato correcto
   * @param phoneNumber Número a validar
   * @returns true si el formato es válido
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    // Formato esperado: número@c.us o número@g.us para grupos
    const phoneRegex = /^\d+@[cg]\.us$/;
    return phoneRegex.test(phoneNumber);
  }
}