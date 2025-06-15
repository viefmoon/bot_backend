import { prisma } from '../server';
import logger from '../utils/logger';
import { sendWhatsAppMessage } from './whatsapp';
import { handleTextMessage } from '../handlers/textMessageHandler';
import { handleInteractiveMessage } from '../handlers/interactiveMessageHandler';

export async function processMessage(from: string, message: any) {
  try {
    // Get or create customer
    const customer = await prisma.customer.upsert({
      where: { customerId: from },
      update: { lastInteraction: new Date() },
      create: {
        customerId: from,
        lastInteraction: new Date()
      }
    });
    
    // Check if customer is banned
    if (customer.isBanned) {
      logger.info(`Banned customer ${from} tried to send message`);
      return;
    }
    
    // Check rate limiting
    const rateLimit = await checkRateLimit(from);
    if (!rateLimit.allowed) {
      await sendWhatsAppMessage(
        from,
        'Has alcanzado el límite de mensajes. Por favor espera unos minutos antes de enviar más mensajes.'
      );
      return;
    }
    
    // Process message based on type
    if (message.type === 'text') {
      await handleTextMessage(from, message.text.body);
    } else if (message.type === 'interactive') {
      await handleInteractiveMessage(from, message.interactive);
    } else if (message.type === 'audio') {
      await sendWhatsAppMessage(
        from,
        'Lo siento, no puedo procesar mensajes de audio en este momento. Por favor envía tu pedido por texto.'
      );
    } else {
      await sendWhatsAppMessage(
        from,
        'Lo siento, solo puedo procesar mensajes de texto por el momento.'
      );
    }
    
  } catch (error) {
    logger.error('Error processing message:', error);
    await sendWhatsAppMessage(
      from,
      'Lo siento, ocurrió un error procesando tu mensaje. Por favor intenta de nuevo.'
    );
  }
}

async function checkRateLimit(customerId: string): Promise<{ allowed: boolean }> {
  const maxMessages = parseInt(process.env.RATE_LIMIT_MAX_MESSAGES || '30');
  const timeWindowMinutes = parseInt(process.env.RATE_LIMIT_TIME_WINDOW_MINUTES || '5');
  
  const rateLimit = await prisma.messageRateLimit.findUnique({
    where: { customerId }
  });
  
  const now = new Date();
  const timeWindowStart = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);
  
  if (!rateLimit) {
    // Create new rate limit record
    await prisma.messageRateLimit.create({
      data: {
        customerId,
        messageCount: 1,
        lastMessageTime: now
      }
    });
    return { allowed: true };
  }
  
  // Check if outside time window
  if (rateLimit.lastMessageTime < timeWindowStart) {
    // Reset counter
    await prisma.messageRateLimit.update({
      where: { customerId },
      data: {
        messageCount: 1,
        lastMessageTime: now
      }
    });
    return { allowed: true };
  }
  
  // Check if within limits
  if (rateLimit.messageCount >= maxMessages) {
    return { allowed: false };
  }
  
  // Increment counter
  await prisma.messageRateLimit.update({
    where: { customerId },
    data: {
      messageCount: rateLimit.messageCount + 1,
      lastMessageTime: now
    }
  });
  
  return { allowed: true };
}