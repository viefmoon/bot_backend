import { MessageMiddleware } from '../types';
import { MessageContext } from '../MessageContext';
import { sendWhatsAppMessage } from '../../whatsapp';
import { RATE_LIMIT_MESSAGE } from '../../../common/config/predefinedMessages';
import { redisKeys } from '../../../common/constants';
import logger from '../../../common/utils/logger';
import { env } from '../../../common/config/envValidator';
import { RedisService } from '../../redis/RedisService';

export class RateLimitMiddleware implements MessageMiddleware {
  name = 'RateLimitMiddleware';
  
  private readonly MAX_MESSAGES = parseInt(env.RATE_LIMIT_MAX_MESSAGES);
  private readonly WINDOW_SECONDS = parseInt(env.RATE_LIMIT_TIME_WINDOW_MINUTES) * 60;

  async process(context: MessageContext): Promise<MessageContext> {
    const redisService = RedisService.getInstance();
    
    try {
      // Try to use Redis for rate limiting
      const redisClient = await this.getRedisClient(redisService);
      
      if (redisClient) {
        return await this.processWithRedis(context, redisClient);
      } else {
        // Redis not available - log warning and continue processing
        logger.warn('Redis not available for rate limiting. Allowing message through.');
        return context;
      }
    } catch (error) {
      logger.error('Error in RateLimitMiddleware:', error);
      // On error, allow the message through to avoid blocking legitimate users
      return context;
    }
  }

  private async getRedisClient(redisService: RedisService): Promise<any | null> {
    await redisService.connect();
    return redisService.getClient();
  }

  private async processWithRedis(context: MessageContext, redisClient: any): Promise<MessageContext> {
    const key = redisKeys.rateLimit(context.message.from);
    
    try {
      // Increment the counter atomically
      const currentCount = await redisClient.incr(key);
      
      // If this is the first message, set the expiration
      if (currentCount === 1) {
        await redisClient.expire(key, this.WINDOW_SECONDS);
      }
      
      // Check if rate limit exceeded
      if (currentCount > this.MAX_MESSAGES) {
        logger.warn(`Rate limit exceeded for customer ${context.message.from} (${currentCount}/${this.MAX_MESSAGES})`);
        
        // Only send the warning message once when limit is first exceeded
        if (currentCount === this.MAX_MESSAGES + 1) {
          await sendWhatsAppMessage(context.message.from, RATE_LIMIT_MESSAGE);
        }
        
        context.stop();
        return context;
      }
      
      logger.debug(`Rate limit check passed for ${context.message.from}: ${currentCount}/${this.MAX_MESSAGES}`);
      return context;
      
    } catch (error) {
      logger.error(`Redis error in rate limiting for ${context.message.from}:`, error);
      // On Redis error, allow the message through
      return context;
    }
  }
}