import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MenuController } from "./controllers/menu.controller";
import { CustomerController } from "./controllers/customer.controller";
import { OrderController } from "./controllers/order.controller";
import { PreOrderController } from "./controllers/pre-order.controller";
import { NotificationPhoneController } from "./controllers/notification-phone.controller";
import { RestaurantConfigController } from "./controllers/restaurant-config.controller";
import { CustomerDeliveryInfoController } from "./controllers/customer-delivery-info.controller";
//import { ProductSelectionController } from "./controllers/product-selection.controller";
import { AvailabilityController } from "./controllers/availability.controller";
import { WebhookController } from "./controllers/webhook.controller";
import { MenuService } from "./services/menu.service";
import { CustomerService } from "./services/customer.service";
import { OrderService } from "./services/order.service";
import { PreOrderService } from "./services/pre-order.service";
import { NotificationPhoneService } from "./services/notification-phone.service";
import { RestaurantConfigService } from "./services/restaurant-config.service";
import { WhatsAppController } from "./controllers/whatsapp.controller";
//import { ProductSelectionService } from "./services/product-selection.service";
import { AvailabilityService } from "./services/availability.service";
import { WebhookService } from "./services/webhook.service";
import { OtpService } from "./services/otp.service";
import { OtpController } from "./controllers/otp.controller";
import { CustomerDeliveryInfoService } from "./services/customer-delivery-info.service";
@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [
    MenuController,
    CustomerController,
    OrderController,
    PreOrderController,
    NotificationPhoneController,
    RestaurantConfigController,
    CustomerDeliveryInfoController,
    WhatsAppController,
    AvailabilityController,
    WebhookController,
    OtpController,
  ],
  providers: [
    MenuService,
    CustomerService,
    OrderService,
    PreOrderService,
    NotificationPhoneService,
    RestaurantConfigService,
    CustomerDeliveryInfoService,
    AvailabilityService,
    WebhookService,
    OtpService,
  ],
})
export class AppModule {}
