import { Controller, Post, Body } from "@nestjs/common";
import { OtpService } from "../services/otp.service";

@Controller("otp")
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post("verify")
  verifyOTP(@Body() body: { clientId: string; otp: string }) {
    const { clientId, otp } = body;
    return this.otpService.verifyOTP(clientId, otp);
  }
}
