import { Controller, Post, Body } from "@nestjs/common";
import { OtpService } from "../services/otp.service";

@Controller("otp")
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post("verify")
  async verifyOtp(@Body() body: { phoneNumber: string; otp: string }) {
    const { phoneNumber, otp } = body;
    const isValid = await this.otpService.verifyOTP(phoneNumber, otp);
    return { success: isValid };
  }
}
