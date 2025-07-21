import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../../lib/prisma';
import logger from '../../common/utils/logger';
import { env } from '../../common/config/envValidator';
import { ExternalServiceError, ErrorCode } from '../../common/services/errors';
import { MessageSplitter } from '../../common/utils/messageSplitter';
import { messageQueue } from '../../queues/messageQueue';
import { WhatsAppMessageJob } from '../../queues/types';
import { redisService } from '../redis/RedisService';
import { redisKeys } from '../../common/constants';

export class WhatsAppService {
  private static readonly WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0';
  private static readonly PHONE_NUMBER_ID = env.WHATSAPP_PHONE_NUMBER_MESSAGING_ID;
  private static readonly ACCESS_TOKEN = env.WHATSAPP_ACCESS_TOKEN;
  private static readonly VERIFY_TOKEN = env.WHATSAPP_VERIFY_TOKEN;
  private static readonly MAX_MESSAGE_LENGTH = 4000; // WhatsApp message length limit with margin
  private static readonly MESSAGE_MAX_AGE_MINUTES = 5; // Ignore messages older than 5 minutes

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

  static async handleWebhook(req: Request, res: Response): Promise<void> {
    const body = JSON.parse(req.body.toString());
    
    // Process messages asynchronously to respond quickly to WhatsApp
    if (body.entry && body.entry.length > 0) {
      // Don't await - process in background to respond immediately
      this.processWebhookMessages(body).catch(error => {
        logger.error('Error processing WhatsApp webhook messages:', error);
      });
    }
    
    // Always respond 200 immediately to WhatsApp to prevent retries
    res.sendStatus(200);
  }

  private static async processWebhookMessages(body: any): Promise<void> {
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

  private static async processIncomingMessage(message: any): Promise<void> {
    try {
      const messageId = message.id;
      const from = message.from;
      
      // 1. Check if message already seen (processed or discarded)
      const existingLog = await prisma.messageLog.findUnique({
        where: { messageId }
      });
      
      if (existingLog) { // Simply existing is enough - it was already seen
        logger.info(`Message ${messageId} already seen, skipping`);
        return;
      }
      
      // 2. Mark as seen immediately to prevent race conditions
      await prisma.messageLog.upsert({
        where: { messageId },
        update: { processed: true },
        create: { messageId, processed: true }
      });
      
      // 3. Check message age
      if (this.MESSAGE_MAX_AGE_MINUTES > 0 && message.timestamp) {
        const messageTimestampSeconds = parseInt(message.timestamp, 10);
        const currentTimestampSeconds = Math.floor(Date.now() / 1000);
        const messageAgeSeconds = currentTimestampSeconds - messageTimestampSeconds;
        const maxAgeSeconds = this.MESSAGE_MAX_AGE_MINUTES * 60;
        
        if (messageAgeSeconds > maxAgeSeconds) {
          const ageMinutes = Math.floor(messageAgeSeconds / 60);
          logger.warn(
            `Ignoring stale webhook message from ${from}. ` +
            `Age: ${ageMinutes} minutes (max allowed: ${this.MESSAGE_MAX_AGE_MINUTES} minutes). ` +
            `Message ID: ${messageId}`
          );
          return; // Stop processing - message is too old
        }
      }
      
      // 4. Set latest message timestamp signal in Redis
      const latestMessageTimestampKey = redisKeys.latestMessageTimestamp(from);
      // Create a combined timestamp: WhatsApp timestamp + server reception time in milliseconds
      // This handles multiple messages in the same second
      const serverTimestamp = Date.now();
      const combinedTimestamp = `${message.timestamp}:${serverTimestamp}`;
      
      // Use a TTL of 300 seconds (5 minutes) to handle longer queue times
      try {
        const setResult = await redisService.set(latestMessageTimestampKey, combinedTimestamp, 300);
        if (!setResult) {
          logger.warn(`[Signal] Failed to set latest timestamp for ${from}. Redis may be unavailable. Proceeding anyway.`);
        } else {
          logger.info(`[DEBUG Signal] Set combined timestamp for ${from}: ${combinedTimestamp} (WA: ${message.timestamp}, Server: ${serverTimestamp})`);
        }
      } catch (error) {
        logger.warn(`[Signal] Error setting timestamp in Redis for ${from}:`, error);
        // Continue processing even if Redis fails
      }
      
      // 5. Prepare job data if message passed age check
      const jobData: WhatsAppMessageJob = {
        id: message.id,
        from: message.from,
        type: message.type,
        timestamp: message.timestamp,
        serverTimestamp: serverTimestamp, // Add server timestamp for combined comparison
        text: message.text,
        interactive: message.interactive,
        audio: message.audio
      };
      
      // Enqueue message for async processing
      // Note: For sequential processing per user, we'll use a different approach
      await messageQueue.add(`msg-${from}`, jobData, {
        jobId: messageId, // Use WhatsApp message ID for deduplication
      });
      
      logger.info(`Message ${messageId} from ${from} enqueued for processing`);
      
    } catch (error) {
      logger.error('Error enqueuing incoming message:', error);
    }
  }

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

  static async sendInteractiveMessage(to: string, interactive: any, contextMessageId?: string): Promise<string> {
    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive
      };

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
      
      // Split long message using unified utility
      const parts = MessageSplitter.splitMessage(message, this.MAX_MESSAGE_LENGTH);
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

}