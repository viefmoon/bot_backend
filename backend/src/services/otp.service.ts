import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  cleanupExpiredOTPs,
} from "../utils/otp";
import logger from "../utils/logger";

@Injectable()
export class OtpService implements OnModuleInit, OnModuleDestroy {
  private cleanupInterval: NodeJS.Timeout;

  generateOTP(): string {
    return generateOTP();
  }

  storeOTP(clientId: string, otp: string): void {
    storeOTP(clientId, otp);
  }

  verifyOTP(clientId: string, otp: string): boolean {
    return verifyOTP(clientId, otp);
  }

  onModuleInit() {
    // Ejecutar la limpieza cada 5 minutos
    this.cleanupInterval = setInterval(
      () => {
        logger.info("Limpiando OTPs expirados...");
        cleanupExpiredOTPs();
      },
      5 * 60 * 1000,
    ); // 5 minutos en milisegundos
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
