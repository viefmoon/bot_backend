import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MenuController } from "./controllers/menu.controller";
import { OrderController } from "./controllers/order.controller";
//import { ProductSelectionController } from "./controllers/product-selection.controller";
import { AvailabilityController } from "./controllers/availability.controller";
import { OrderStatusController } from "./controllers/order-status.controller";
import { WebhookController } from "./controllers/webhook.controller";
import { MenuService } from "./services/menu.service";
import { OrderService } from "./services/order.service";
//import { ProductSelectionService } from "./services/product-selection.service";
import { AvailabilityService } from "./services/availability.service";
import { OrderStatusService } from "./services/order-status.service";
import { WebhookService } from "./services/webhook.service";

@Module({
  imports: [
    ConfigModule.forRoot(),
    // Otros módulos que necesites
  ],
  controllers: [
    MenuController,
    OrderController,
    //ProductSelectionController,
    AvailabilityController,
    OrderStatusController,
    WebhookController,
  ],
  providers: [
    MenuService,
    OrderService,
    //ProductSelectionService,
    AvailabilityService,
    OrderStatusService,
    WebhookService,
  ],
})
export class AppModule {}
