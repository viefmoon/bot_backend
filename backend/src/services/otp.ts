import { prisma } from '../server';
import logger from '../common/utils/logger';
import crypto from 'crypto';

// In-memory OTP storage with expiration
const otpStore = new Map<string, { code: string; expires: Date }>();

export async function generateAndSendOTP(customerId: string): Promise<boolean> {
  try {
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Store OTP with 5-minute expiration
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    otpStore.set(customerId, { code: otp, expires });

    // In a real application, you would send SMS here
    // For now, just log it
    logger.info(`OTP for customer ${customerId}: ${otp}`);

    // You could also send it via WhatsApp for testing
    // await sendWhatsAppMessage(customerId, `Tu código de verificación es: ${otp}`);

    return true;
  } catch (error) {
    logger.error('Error generating OTP:', error);
    return false;
  }
}

export async function verifyOTP(customerId: string, code: string): Promise<boolean> {
  try {
    const storedOTP = otpStore.get(customerId);
    
    if (!storedOTP) {
      return false;
    }

    // Check if expired
    if (new Date() > storedOTP.expires) {
      otpStore.delete(customerId);
      return false;
    }

    // Verify code
    if (storedOTP.code === code) {
      otpStore.delete(customerId); // Remove after successful verification
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    return false;
  }
}

export async function invalidateOTP(customerId: string): Promise<void> {
  otpStore.delete(customerId);
}

// Clean up expired OTPs periodically
setInterval(() => {
  const now = new Date();
  for (const [customerId, otp] of otpStore.entries()) {
    if (now > otp.expires) {
      otpStore.delete(customerId);
    }
  }
}, 60000); // Run every minute