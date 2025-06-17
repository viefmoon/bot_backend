import { prisma } from '../../server';
import logger from '../../common/utils/logger';
import crypto from 'crypto';
import { ValidationError, ErrorCode } from '../../common/services/errors';

/**
 * Service for managing One-Time Passwords (OTP)
 */
export class OTPService {
  private static otpStore = new Map<string, { code: string; expires: Date }>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly MAX_OTP_ENTRIES = 10000;
  private static readonly OTP_EXPIRY_MINUTES = 10;
  private static readonly ADDRESS_OTP_EXPIRY_MINUTES = 10; // Mismo tiempo para todos los OTP

  /**
   * Generate a new OTP code
   */
  static generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Store an OTP for a customer
   */
  static storeOTP(customerId: string, otp: string, isAddressRegistration: boolean = false): void {
    // Check store size limit
    if (this.otpStore.size >= this.MAX_OTP_ENTRIES) {
      this.cleanupOldestEntries();
    }

    const expiryMinutes = isAddressRegistration ? this.ADDRESS_OTP_EXPIRY_MINUTES : this.OTP_EXPIRY_MINUTES;
    const expires = new Date(Date.now() + expiryMinutes * 60 * 1000);
    this.otpStore.set(customerId, { code: otp, expires });
    
    logger.info(`OTP stored for customer ${customerId} (expires at ${expires.toISOString()}) - Type: ${isAddressRegistration ? 'Address Registration' : 'Standard'}`);
  }

  /**
   * Generate and store OTP for a customer
   */
  static async generateAndSendOTP(customerId: string): Promise<boolean> {
    try {
      const otp = this.generateOTP();
      this.storeOTP(customerId, otp);

      // In production, send via SMS/WhatsApp
      // For development, just log it
      logger.info(`OTP for customer ${customerId}: ${otp}`);

      return true;
    } catch (error) {
      logger.error('Error generating OTP:', error);
      return false;
    }
  }

  /**
   * Verify an OTP
   */
  static async verifyOTP(customerId: string, code: string): Promise<boolean> {
    try {
      logger.info(`Verifying OTP for customer ${customerId}, code: ${code}`);
      
      // Log all stored OTPs for debugging
      logger.debug(`Current OTP store size: ${this.otpStore.size}`);
      for (const [key, value] of this.otpStore.entries()) {
        logger.debug(`Stored OTP - Customer: ${key}, Code: ${value.code}, Expires: ${value.expires.toISOString()}`);
      }
      
      const storedOTP = this.otpStore.get(customerId);
      
      if (!storedOTP) {
        logger.warn(`No OTP found for customer ${customerId}`);
        return false;
      }

      // Check if expired
      if (new Date() > storedOTP.expires) {
        this.otpStore.delete(customerId);
        logger.warn(`OTP expired for customer ${customerId} - Expired at: ${storedOTP.expires.toISOString()}, Current time: ${new Date().toISOString()}`);
        return false;
      }

      // Verify code
      if (storedOTP.code === code) {
        // Don't delete immediately for address registration - allow multiple verifications
        logger.info(`OTP verified successfully for customer ${customerId}`);
        return true;
      }

      logger.warn(`Invalid OTP attempt for customer ${customerId} - Expected: ${storedOTP.code}, Received: ${code}`);
      return false;
    } catch (error) {
      logger.error('Error verifying OTP:', error);
      return false;
    }
  }

  /**
   * Invalidate an OTP
   */
  static async invalidateOTP(customerId: string): Promise<void> {
    this.otpStore.delete(customerId);
    logger.info(`OTP invalidated for customer ${customerId}`);
  }

  /**
   * Clean up oldest OTP entries when limit is reached
   */
  private static cleanupOldestEntries(): void {
    logger.warn('OTP store limit reached, cleaning up oldest entries');
    
    const entries = Array.from(this.otpStore.entries())
      .sort((a, b) => a[1].expires.getTime() - b[1].expires.getTime())
      .slice(0, Math.floor(this.MAX_OTP_ENTRIES * 0.1)); // Remove 10% of oldest
    
    entries.forEach(([key]) => this.otpStore.delete(key));
    logger.info(`Cleaned up ${entries.length} OTP entries`);
  }

  /**
   * Clean up expired OTPs
   */
  private static cleanupExpiredOTPs(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [customerId, otp] of this.otpStore.entries()) {
      if (now > otp.expires) {
        this.otpStore.delete(customerId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired OTPs`);
    }
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
  static getStats(): { total: number; expired: number } {
    const now = new Date();
    let expired = 0;

    for (const [, otp] of this.otpStore.entries()) {
      if (now > otp.expires) {
        expired++;
      }
    }

    return {
      total: this.otpStore.size,
      expired
    };
  }
}