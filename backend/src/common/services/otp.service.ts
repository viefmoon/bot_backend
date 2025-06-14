import { Injectable } from '@nestjs/common';
import { generateOTP as generateOTPUtil, storeOTP as storeOTPUtil, verifyOTP as verifyOTPUtil, cleanupExpiredOTPs } from '../utils/otp';
import { sendWhatsAppMessage } from '../../whatsapp/utils/whatsapp.utils';
import { Customer } from '../../database/entities';
import logger from '../utils/logger';

@Injectable()
export class OtpService {
  constructor() {
    // Limpiar OTPs expirados cada 5 minutos
    setInterval(() => {
      cleanupExpiredOTPs();
    }, 5 * 60 * 1000);
  }

  generateOTP(): string {
    return generateOTPUtil();
  }

  async storeOTP(customerId: string, otp: string): Promise<void> {
    storeOTPUtil(customerId, otp);
  }

  async sendOTP(customerId: string): Promise<void> {
    try {
      const customer = await Customer.findOne({
        where: { customerId }
      });

      if (!customer) {
        throw new Error('Cliente no encontrado');
      }

      const otp = this.generateOTP();
      await this.storeOTP(customerId, otp);

      const message = `Tu código de verificación es: *${otp}*\n\nEste código expirará en 10 minutos.`;
      await sendWhatsAppMessage(customerId, message);

      logger.info(`OTP enviado a ${customerId}`);
    } catch (error) {
      logger.error('Error al enviar OTP:', error);
      throw error;
    }
  }

  verifyOTP(customerId: string, otp: string): boolean {
    return verifyOTPUtil(customerId, otp);
  }
}