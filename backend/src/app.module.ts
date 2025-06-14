import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CustomerController } from "./controllers/customer.controller";
import { PreOrderController } from "./controllers/pre-order.controller";
import { CustomerDeliveryInfoController } from "./controllers/customer-delivery-info.controller";
import { WebhookController } from "./controllers/webhook.controller";
import { CustomerService } from "./services/customer.service";
import { PreOrderService } from "./services/pre-order.service";
import { WebhookService } from "./services/webhook.service";
import { OtpService } from "./services/otp.service";
import { OtpController } from "./controllers/otp.controller";
import { CustomerDeliveryInfoService } from "./services/customer-delivery-info.service";
import { WhatsAppController } from "./controllers/whatsapp.controller";
import { MenuService } from "./services/menu.service";
import { RestaurantConfigService } from "./services/restaurant-config.service";

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [
    CustomerController,
    PreOrderController,
    CustomerDeliveryInfoController,
    WebhookController,
    OtpController,
    WhatsAppController,
  ],
  providers: [
    CustomerService,
    PreOrderService,
    CustomerDeliveryInfoService,
    WebhookService,
    OtpService,
    MenuService,
    RestaurantConfigService,
  ],
})
export class AppModule {}
