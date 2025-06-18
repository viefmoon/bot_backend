import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { prisma } from '../../../server';
import { sendWhatsAppMessage } from '../../whatsapp';
import { RATE_LIMIT_MESSAGE } from '../../../common/config/predefinedMessages';
import logger from '../../../common/utils/logger';
import { env } from '../../../common/config/envValidator';

export class RateLimitMiddleware implements MessageMiddleware {
  name = 'RateLimitMiddleware';
  
  private readonly RATE_LIMIT_MESSAGES = parseInt(env.RATE_LIMIT_MAX_MESSAGES);
  private readonly RATE_LIMIT_WINDOW_MINUTES = parseInt(env.RATE_LIMIT_TIME_WINDOW_MINUTES);

  async process(context: MessageContext): Promise<MessageContext> {
    try {
      const whatsappPhoneNumber = context.message.from;
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

      // Verificar límite de tasa existente
      const rateLimit = await prisma.messageRateLimit.findUnique({
        where: { whatsappPhoneNumber }
      });

      if (rateLimit && rateLimit.lastMessageTime > windowStart) {
        // Dentro de la ventana de límite de tasa
        if (rateLimit.messageCount >= this.RATE_LIMIT_MESSAGES) {
          // Límite de tasa excedido
          logger.warn(`Rate limit exceeded for customer ${whatsappPhoneNumber}`);
          await sendWhatsAppMessage(whatsappPhoneNumber, RATE_LIMIT_MESSAGE);
          context.stop();
          return context;
        }

        // Incrementar contador de mensajes
        await prisma.messageRateLimit.update({
          where: { whatsappPhoneNumber },
          data: {
            messageCount: rateLimit.messageCount + 1,
            lastMessageTime: now
          }
        });
      } else {
        // Fuera de la ventana de límite o sin registro de límite
        await prisma.messageRateLimit.upsert({
          where: { whatsappPhoneNumber },
          update: {
            messageCount: 1,
            lastMessageTime: now
          },
          create: {
            whatsappPhoneNumber,
            messageCount: 1,
            lastMessageTime: now
          }
        });
      }

      return context;
    } catch (error) {
      logger.error('Error in RateLimitMiddleware:', error);
      context.setError(error as Error);
      return context;
    }
  }
}