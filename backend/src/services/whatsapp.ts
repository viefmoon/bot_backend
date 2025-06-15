import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../server';
import logger from '../utils/logger';
import { processMessage } from './messageProcessor';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_MESSAGING_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

export function verifyWebhook(query: any) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      logger.info('Webhook verified');
      return { verified: true, challenge };
    }
  }
  
  return { verified: false };
}

export async function handleWhatsAppWebhook(req: Request, res: Response) {
  try {
    const body = JSON.parse(req.body.toString());
    
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (entry.changes && entry.changes.length > 0) {
          for (const change of entry.changes) {
            if (change.value.messages && change.value.messages.length > 0) {
              for (const message of change.value.messages) {
                await processIncomingMessage(message);
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

async function processIncomingMessage(message: any) {
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
    await processMessage(from, message);
    
  } catch (error) {
    logger.error('Error processing incoming message:', error);
  }
}

export async function sendWhatsAppMessage(to: string, message: string) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info(`Message sent to ${to}:`, response.data);
    return { success: true, messageId: response.data.messages[0].id };
  } catch (error: any) {
    logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendWhatsAppInteractiveMessage(to: string, interactive: any) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info(`Interactive message sent to ${to}:`, response.data);
    return response.data.messages[0].id;
  } catch (error: any) {
    logger.error('Error sending interactive message:', error.response?.data || error.message);
    throw error;
  }
}