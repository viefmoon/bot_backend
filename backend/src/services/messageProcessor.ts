import { prisma } from '../server';
import logger from '../utils/logger';
import { sendWhatsAppMessage } from './whatsapp';
import { generateAIResponse } from './ai';

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
    const bannedCustomer = await prisma.bannedCustomer.findUnique({
      where: { customerId: from }
    });
    
    if (bannedCustomer) {
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
    let userMessage = '';
    
    if (message.type === 'text') {
      userMessage = message.text.body;
    } else if (message.type === 'interactive') {
      userMessage = message.interactive.button_reply?.title || '';
    } else {
      await sendWhatsAppMessage(
        from,
        'Lo siento, solo puedo procesar mensajes de texto por el momento.'
      );
      return;
    }
    
    // Generate AI response
    const aiResponse = await generateAIResponse(customer, userMessage);
    
    // Send response
    await sendWhatsAppMessage(from, aiResponse);
    
    // Update chat history
    const chatHistory = customer.fullChatHistory as any[] || [];
    chatHistory.push({
      timestamp: new Date(),
      from: 'user',
      message: userMessage
    });
    chatHistory.push({
      timestamp: new Date(),
      from: 'assistant',
      message: aiResponse
    });
    
    await prisma.customer.update({
      where: { customerId: from },
      data: {
        fullChatHistory: chatHistory,
        relevantChatHistory: chatHistory.slice(-10) // Keep last 10 messages
      }
    });
    
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