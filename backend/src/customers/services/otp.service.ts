import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  cleanupExpiredOTPs,
} from "../../common/utils/otp";
import logger from "../../common/utils/logger";

@Injectable()
export class OtpService implements OnModuleInit, OnModuleDestroy {
  private cleanupInterval: NodeJS.Timeout;

  generateOTP(): string {
    return generateOTP();
  }

  storeOTP(customerId: string, otp: string): void {
    storeOTP(customerId, otp);
  }

  verifyOTP(customerId: string, otp: string): boolean {
    return verifyOTP(customerId, otp);
  }

  invalidateOTP(customerId: string): void {
    storeOTP(customerId, "");
  }

  onModuleInit() {
    // Ejecutar la limpieza cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      logger.info("Limpiando OTPs expirados...");
      cleanupExpiredOTPs();
    }, 5 * 60 * 1000); // 5 minutos en milisegundos
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
