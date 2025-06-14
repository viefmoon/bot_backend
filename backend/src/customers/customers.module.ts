import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerDeliveryInfoController } from './customer-delivery-info.controller';
import { OtpController } from './otp.controller';
import { CustomerService } from './services/customer.service';
import { CustomerDeliveryInfoService } from './services/customer-delivery-info.service';
import { OtpService } from './services/otp.service';

@Module({
  controllers: [CustomerController, CustomerDeliveryInfoController, OtpController],
  providers: [CustomerService, CustomerDeliveryInfoService, OtpService],
  exports: [CustomerService, CustomerDeliveryInfoService, OtpService],
})
export class CustomersModule {}