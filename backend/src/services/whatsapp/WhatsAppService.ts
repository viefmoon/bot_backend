import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../../server';
import logger from '../../common/utils/logger';
import { MessageProcessor } from '../messaging/MessageProcessor';
import { env } from '../../common/config/envValidator';
import { ExternalServiceError, ErrorCode } from '../../common/services/errors';

/**
 * Service for WhatsApp Business API communication
 */
export class WhatsAppService {
  private static readonly WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0';
  private static readonly PHONE_NUMBER_ID = env.WHATSAPP_PHONE_NUMBER_MESSAGING_ID;
  private static readonly ACCESS_TOKEN = env.WHATSAPP_ACCESS_TOKEN;
  private static readonly VERIFY_TOKEN = env.WHATSAPP_VERIFY_TOKEN;
  private static readonly MAX_MESSAGE_LENGTH = 4000; // WhatsApp message length limit with margin

  /**
   * Verify webhook for WhatsApp
   */
  static verifyWebhook(query: any): { verified: boolean; challenge?: string } {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === this.VERIFY_TOKEN) {
        logger.info('Webhook verified');
        return { verified: true, challenge };
      }
    }
    
    return { verified: false };
  }

  /**
   * Handle incoming webhook from WhatsApp
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const body = JSON.parse(req.body.toString());
      
      if (body.entry && body.entry.length > 0) {
        for (const entry of body.entry) {
          if (entry.changes && entry.changes.length > 0) {
            for (const change of entry.changes) {
              if (change.value.messages && change.value.messages.length > 0) {
                for (const message of change.value.messages) {
                  await this.processIncomingMessage(message);
                }
              }
            }
          }
        }
      }
      
      res.sendStatus(200);
    } catch (error) {
      logger.error('Error processing WhatsApp webhook:', error);
      res.sendStatus(500);
    }
  }

  /**
   * Process an incoming message
   */
  private static async processIncomingMessage(message: any): Promise<void> {
    try {
      const messageId = message.id;
      const from = message.from;
      
      // Check if message was already processed
      const existingLog = await prisma.messageLog.findUnique({
        where: { messageId }
      });
      
      if (existingLog?.processed) {
        logger.info(`Message ${messageId} already processed`);
        return;
      }
      
      // Mark message as being processed
      await prisma.messageLog.upsert({
        where: { messageId },
        update: { processed: true },
        create: { messageId, processed: true }
      });
      
      // Process the message
      await MessageProcessor.processWithPipeline({
        ...message,
        from
      });
      
    } catch (error) {
      logger.error('Error processing incoming message:', error);
    }
  }

  /**
   * Send a text message via WhatsApp
   */
  static async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${this.WHATSAPP_API_URL}/${this.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.debug(`Full message sent to ${to}:`, message);
      logger.info(`Message sent to ${to} (${message.length} chars)`);
      return { success: true, messageId: response.data.messages[0].id };
    } catch (error: any) {
      logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send an interactive message via WhatsApp
   */
  static async sendInteractiveMessage(to: string, interactive: any, contextMessageId?: string): Promise<string> {
    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive
      };

      // Add context if provided
      if (contextMessageId) {
        payload.context = { message_id: contextMessageId };
      }

      const response = await axios.post(
        `${this.WHATSAPP_API_URL}/${this.PHONE_NUMBER_ID}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const messageType = interactive.type || 'interactive';
      const buttonText = interactive.action?.button || interactive.action?.buttons?.[0]?.reply?.title || '';
      logger.info(`Interactive message (${messageType}) sent to ${to}${buttonText ? `: "${buttonText}"` : ''}`);
      return response.data.messages[0].id;
    } catch (error: any) {
      logger.error('Error sending interactive message:', error.response?.data || error.message);
      throw new ExternalServiceError(
        ErrorCode.WHATSAPP_ERROR,
        'Failed to send interactive message',
        { metadata: { to, error: error.message } }
      );
    }
  }

  /**
   * Get media URL from WhatsApp
   */
  static async getMediaUrl(mediaId: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.WHATSAPP_API_URL}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.ACCESS_TOKEN}`
          }
        }
      );
      
      return response.data.url;
    } catch (error: any) {
      logger.error('Error getting media URL:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Download media from WhatsApp
   */
  static async downloadMedia(mediaUrl: string): Promise<Buffer | null> {
    try {
      const response = await axios.get(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${this.ACCESS_TOKEN}`
        },
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error('Error downloading media:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Mark message as read
   */
  static async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      await axios.post(
        `${this.WHATSAPP_API_URL}/${this.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return true;
    } catch (error: any) {
      logger.error('Error marking message as read:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Send a message with a URL button
   */
  static async sendMessageWithUrlButton(
    to: string, 
    headerText: string,
    bodyText: string, 
    buttonText: string, 
    url: string,
    footerText?: string
  ): Promise<boolean> {
    try {
      const interactive = {
        type: "cta_url",
        header: {
          type: "text",
          text: headerText
        },
        body: {
          text: bodyText
        },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          name: "cta_url",
          parameters: {
            display_text: buttonText,
            url: url
          }
        }
      };

      await this.sendInteractiveMessage(to, interactive);
      return true;
    } catch (error) {
      logger.error('Error sending message with URL button:', error);
      return false;
    }
  }

  /**
   * Send a WhatsApp message, automatically splitting long messages
   */
  static async sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
    try {
      if (message.length <= this.MAX_MESSAGE_LENGTH) {
        const result = await this.sendMessage(to, message);
        if (!result.success) {
          throw new ExternalServiceError(
            ErrorCode.WHATSAPP_ERROR,
            result.error || 'Failed to send message',
            { metadata: { to, messageLength: message.length } }
          );
        }
        return true;
      }
      
      // Split long message
      const parts = this.splitLongMessage(message, this.MAX_MESSAGE_LENGTH);
      logger.debug(`Message split into ${parts.length} parts`);
      
      // Send each part
      for (const part of parts) {
        const result = await this.sendMessage(to, part);
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
      logger.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  /**
   * Split a long message into parts respecting lines and words
   */
  private static splitLongMessage(text: string, maxLength: number): string[] {
    const parts: string[] = [];
    const lines = text.split('\n');
    let currentPart = '';
    
    for (const line of lines) {
      // If adding this line exceeds the limit
      if (currentPart.length + line.length + 1 > maxLength) {
        // If the line alone is too long, split it by words
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
          // Save current part and start a new one
          if (currentPart.trim()) {
            parts.push(currentPart.trim());
          }
          currentPart = line + '\n';
        }
      } else {
        // Add line to current part
        currentPart += line + '\n';
      }
    }
    
    // Add any remaining content
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    return parts;
  }
}