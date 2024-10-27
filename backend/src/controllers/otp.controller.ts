import { Controller, Post, Body } from "@nestjs/common";
import { OtpService } from "../services/otp.service";

@Controller("otp")
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post("verify")
  verifyOTP(@Body() body: { customerId: string; otp: string }) {
    const { customerId, otp } = body;
    return this.otpService.verifyOTP(customerId, otp);
  }

  @Post("invalidate")
  invalidateOTP(@Body() body: { customerId: string }) {
    const { customerId } = body;
    return this.otpService.invalidateOTP(customerId);
  }
}
