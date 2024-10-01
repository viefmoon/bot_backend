"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const menu_controller_1 = require("./controllers/menu.controller");
const order_controller_1 = require("./controllers/order.controller");
const availability_controller_1 = require("./controllers/availability.controller");
const order_status_controller_1 = require("./controllers/order-status.controller");
const webhook_controller_1 = require("./controllers/webhook.controller");
const menu_service_1 = require("./services/menu.service");
const order_service_1 = require("./services/order.service");
const availability_service_1 = require("./services/availability.service");
const order_status_service_1 = require("./services/order-status.service");
const webhook_service_1 = require("./services/webhook.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot(),
        ],
        controllers: [
            menu_controller_1.MenuController,
            order_controller_1.OrderController,
            availability_controller_1.AvailabilityController,
            order_status_controller_1.OrderStatusController,
            webhook_controller_1.WebhookController,
        ],
        providers: [
            menu_service_1.MenuService,
            order_service_1.OrderService,
            availability_service_1.AvailabilityService,
            order_status_service_1.OrderStatusService,
            webhook_service_1.WebhookService,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map