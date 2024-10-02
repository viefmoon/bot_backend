import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  cleanupExpiredOTPs,
} from "../utils/otp";

@Injectable()
export class OtpService {
  generateOTP(): string {
    return generateOTP();
  }

  storeOTP(phoneNumber: string, otp: string): void {
    storeOTP(phoneNumber, otp);
  }

  verifyOTP(phoneNumber: string, otp: string): boolean {
    return verifyOTP(phoneNumber, otp);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  handleCron() {
    console.log("Limpiando OTPs expirados...");
    cleanupExpiredOTPs();
  }
}
