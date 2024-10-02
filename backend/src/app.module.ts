import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { MenuController } from "./controllers/menu.controller";
import { CustomerController } from "./controllers/customer.controller";
import { OrderController } from "./controllers/order.controller";
import { NotificationPhoneController } from "./controllers/notification-phone.controller";
import { RestaurantConfigController } from "./controllers/restaurant-config.controller";
//import { ProductSelectionController } from "./controllers/product-selection.controller";
import { AvailabilityController } from "./controllers/availability.controller";
import { OrderStatusController } from "./controllers/order-status.controller";
import { WebhookController } from "./controllers/webhook.controller";
import { MenuService } from "./services/menu.service";
import { CustomerService } from "./services/customer.service";
import { OrderService } from "./services/order.service";
import { NotificationPhoneService } from "./services/notification-phone.service";
import { RestaurantConfigService } from "./services/restaurant-config.service";
//import { ProductSelectionService } from "./services/product-selection.service";
import { AvailabilityService } from "./services/availability.service";
import { OrderStatusService } from "./services/order-status.service";
import { WebhookService } from "./services/webhook.service";
import { OtpService } from "./services/otp.service";

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    // Otros módulos que necesites
  ],
  controllers: [
    MenuController,
    CustomerController,
    OrderController,
    NotificationPhoneController,
    RestaurantConfigController,
    //ProductSelectionController,
    AvailabilityController,
    OrderStatusController,
    WebhookController,
  ],
  providers: [
    MenuService,
    CustomerService,
    OrderService,
    NotificationPhoneService,
    RestaurantConfigService,
    //ProductSelectionService,
    AvailabilityService,
    OrderStatusService,
    WebhookService,
    OtpService,
  ],
})
export class AppModule {}
