import logger from '../../common/utils/logger';
import crypto from 'crypto';
import { redisService } from '../redis/RedisService';
import { redisKeys, REDIS_KEYS } from '../../common/constants';

/**
 * Service for managing One-Time Passwords (OTP)
 */
export class OTPService {
  // Fallback to memory if Redis is not available
  private static memoryStore = new Map<string, { code: string; expires: Date }>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly OTP_EXPIRY_MINUTES = 10;
  /**
   * Get Redis key for OTP
   */
  private static getRedisKey(whatsappPhoneNumber: string): string {
    return redisKeys.otp(whatsappPhoneNumber);
  }

  /**
   * Generate a new OTP code
   */
  static generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Store an OTP for a WhatsApp phone number
   */
  static async storeOTP(whatsappPhoneNumber: string, otp: string, isAddressRegistration: boolean = false): Promise<void> {
    const expires = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
    const expiresInSeconds = this.OTP_EXPIRY_MINUTES * 60;
    
    // Try Redis first
    if (redisService.isAvailable()) {
      const key = this.getRedisKey(whatsappPhoneNumber);
      const data = { code: otp, expires: expires.toISOString() };
      const stored = await redisService.setJSON(key, data, expiresInSeconds);
      
      if (stored) {
        logger.info(`OTP stored in Redis for phone ${whatsappPhoneNumber} (expires at ${expires.toISOString()})`);
        return;
      }
    }
    
    // Fallback to memory
    this.memoryStore.set(whatsappPhoneNumber, { code: otp, expires });
    logger.info(`OTP stored in memory for phone ${whatsappPhoneNumber} (expires at ${expires.toISOString()})`);
  }

  /**
   * Generate and store OTP for a WhatsApp phone number
   */
  static async generateAndSendOTP(whatsappPhoneNumber: string): Promise<boolean> {
    try {
      const otp = this.generateOTP();
      await this.storeOTP(whatsappPhoneNumber, otp);

      // In production, send via SMS/WhatsApp
      // For development, just log it
      logger.info(`OTP for phone ${whatsappPhoneNumber}: ${otp}`);

      return true;
    } catch (error) {
      logger.error('Error generating OTP:', error);
      return false;
    }
  }

  /**
   * Verify an OTP
   */
  static async verifyOTP(whatsappPhoneNumber: string, code: string): Promise<boolean> {
    try {
      logger.info(`Verifying OTP for phone ${whatsappPhoneNumber}, code: ${code}`);
      
      let storedOTP: { code: string; expires: Date | string } | null = null;
      
      // Try Redis first
      if (redisService.isAvailable()) {
        const key = this.getRedisKey(whatsappPhoneNumber);
        const redisData = await redisService.getJSON<{ code: string; expires: string }>(key);
        
        if (redisData) {
          storedOTP = { code: redisData.code, expires: new Date(redisData.expires) };
          logger.debug(`OTP found in Redis for phone ${whatsappPhoneNumber}`);
        }
      }
      
      // Fallback to memory if not found in Redis
      if (!storedOTP) {
        const memoryData = this.memoryStore.get(whatsappPhoneNumber);
        if (memoryData) {
          storedOTP = memoryData;
          logger.debug(`OTP found in memory for phone ${whatsappPhoneNumber}`);
        }
      }
      
      if (!storedOTP) {
        logger.warn(`No OTP found for phone ${whatsappPhoneNumber}`);
        return false;
      }

      // Check if expired
      const expiryDate = storedOTP.expires instanceof Date ? storedOTP.expires : new Date(storedOTP.expires);
      if (new Date() > expiryDate) {
        await this.invalidateOTP(whatsappPhoneNumber);
        logger.warn(`OTP expired for phone ${whatsappPhoneNumber} - Expired at: ${expiryDate.toISOString()}, Current time: ${new Date().toISOString()}`);
        return false;
      }

      // Verify code
      if (storedOTP.code === code) {
        // Don't delete immediately for address registration - allow multiple verifications
        logger.info(`OTP verified successfully for phone ${whatsappPhoneNumber}`);
        return true;
      }

      logger.warn(`Invalid OTP attempt for phone ${whatsappPhoneNumber} - Expected: ${storedOTP.code}, Received: ${code}`);
      return false;
    } catch (error) {
      logger.error('Error verifying OTP:', error);
      return false;
    }
  }

  /**
   * Invalidate an OTP
   */
  static async invalidateOTP(whatsappPhoneNumber: string): Promise<void> {
    // Try Redis first
    if (redisService.isAvailable()) {
      const key = this.getRedisKey(whatsappPhoneNumber);
      await redisService.del(key);
    }
    
    // Also remove from memory
    this.memoryStore.delete(whatsappPhoneNumber);
    logger.info(`OTP invalidated for phone ${whatsappPhoneNumber}`);
  }


  /**
   * Clean up expired OTPs from memory store
   */
  private static cleanupExpiredOTPs(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [whatsappPhoneNumber, otp] of this.memoryStore.entries()) {
      if (now > otp.expires) {
        this.memoryStore.delete(whatsappPhoneNumber);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired OTPs from memory`);
    }
    
    // Note: Redis handles expiration automatically, no need to clean up there
  }

  /**
   * Start periodic cleanup of expired OTPs
   */
  static startOTPCleanup(): void {
    if (this.cleanupInterval) return; // Already running
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredOTPs();
    }, 60000); // Run every minute
    
    logger.info('OTP cleanup interval started');
  }

  /**
   * Stop periodic cleanup
   */
  static stopOTPCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('OTP cleanup interval stopped');
    }
  }

  /**
   * Get OTP statistics (for monitoring)
   */
  static async getStats(): Promise<{ total: number; expired: number; source: 'redis' | 'memory' | 'both' }> {
    const now = new Date();
    let expired = 0;
    let total = 0;
    let source: 'redis' | 'memory' | 'both' = 'memory';
    
    // Check Redis if available
    if (redisService.isAvailable()) {
      const keys = await redisService.keys(`${REDIS_KEYS.OTP_PREFIX}*`);
      total = keys.length;
      
      // For expired count in Redis, we'd need to check each key
      // which is expensive, so we'll skip it for Redis
      source = 'redis';
    } else {
      // Use memory store
      total = this.memoryStore.size;
      for (const [, otp] of this.memoryStore.entries()) {
        if (now > otp.expires) {
          expired++;
        }
      }
    }

    return {
      total,
      expired,
      source
    };
  }
}