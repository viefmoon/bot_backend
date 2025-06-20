import logger from '../../common/utils/logger';
import crypto from 'crypto';

/**
 * Service for managing One-Time Passwords (OTP)
 */
export class OTPService {
  private static otpStore = new Map<string, { code: string; expires: Date }>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly MAX_OTP_ENTRIES = 10000;
  private static readonly OTP_EXPIRY_MINUTES = 10;

  /**
   * Generate a new OTP code
   */
  static generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Store an OTP for a WhatsApp phone number
   */
  static storeOTP(whatsappPhoneNumber: string, otp: string, isAddressRegistration: boolean = false): void {
    // Check store size limit
    if (this.otpStore.size >= this.MAX_OTP_ENTRIES) {
      this.cleanupOldestEntries();
    }

    const expires = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
    this.otpStore.set(whatsappPhoneNumber, { code: otp, expires });
    
    logger.info(`OTP stored for phone ${whatsappPhoneNumber} (expires at ${expires.toISOString()})`);
  }

  /**
   * Generate and store OTP for a WhatsApp phone number
   */
  static async generateAndSendOTP(whatsappPhoneNumber: string): Promise<boolean> {
    try {
      const otp = this.generateOTP();
      this.storeOTP(whatsappPhoneNumber, otp);

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
      
      // Log all stored OTPs for debugging
      logger.debug(`Current OTP store size: ${this.otpStore.size}`);
      for (const [key, value] of this.otpStore.entries()) {
        logger.debug(`Stored OTP - Phone: ${key}, Code: ${value.code}, Expires: ${value.expires.toISOString()}`);
      }
      
      const storedOTP = this.otpStore.get(whatsappPhoneNumber);
      
      if (!storedOTP) {
        logger.warn(`No OTP found for phone ${whatsappPhoneNumber}`);
        return false;
      }

      // Check if expired
      if (new Date() > storedOTP.expires) {
        this.otpStore.delete(whatsappPhoneNumber);
        logger.warn(`OTP expired for phone ${whatsappPhoneNumber} - Expired at: ${storedOTP.expires.toISOString()}, Current time: ${new Date().toISOString()}`);
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
    this.otpStore.delete(whatsappPhoneNumber);
    logger.info(`OTP invalidated for phone ${whatsappPhoneNumber}`);
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
    
    for (const [whatsappPhoneNumber, otp] of this.otpStore.entries()) {
      if (now > otp.expires) {
        this.otpStore.delete(whatsappPhoneNumber);
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