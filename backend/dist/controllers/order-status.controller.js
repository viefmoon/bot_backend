"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatusController = void 0;
const common_1 = require("@nestjs/common");
const order_status_service_1 = require("../services/order-status.service");
const update_order_status_dto_1 = require("../dto/update-order-status.dto");
let OrderStatusController = class OrderStatusController {
    constructor(orderStatusService) {
        this.orderStatusService = orderStatusService;
    }
    async updateOrderStatus(updateOrderStatusDto) {
        return this.orderStatusService.updateOrderStatus(updateOrderStatusDto);
    }
};
exports.OrderStatusController = OrderStatusController;
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_order_status_dto_1.UpdateOrderStatusDto]),
    __metadata("design:returntype", Promise)
], OrderStatusController.prototype, "updateOrderStatus", null);
exports.OrderStatusController = OrderStatusController = __decorate([
    (0, common_1.Controller)("order-status"),
    __metadata("design:paramtypes", [order_status_service_1.OrderStatusService])
], OrderStatusController);
//# sourceMappingURL=order-status.controller.js.map