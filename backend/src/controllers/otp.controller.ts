import { Controller, Post, Body } from "@nestjs/common";
import { OtpService } from "../services/otp.service";

@Controller("otp")
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post("verify")
  verifyOTP(@Body() body: { clientId: string, otp: string }) {
    console.log("Cuerpo de la solicitud:", body);
    const { clientId, otp } = body;
    console.log("clientId en controlador:", clientId);
    console.log("otp en controlador:", otp);
    return this.otpService.verifyOTP(clientId, otp);
  }
}
