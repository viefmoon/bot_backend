import { Module, Global } from '@nestjs/common';
import { OtpService } from './services/otp.service';

@Global()
@Module({
  providers: [OtpService],
  exports: [OtpService],
})
export class CommonModule {}