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
exports.CustomerDeliveryController = void 0;
const common_1 = require("@nestjs/common");
const customer_delivery_service_1 = require("../services/customer-delivery.service");
let CustomerDeliveryController = class CustomerDeliveryController {
    constructor(customerDeliveryService) {
        this.customerDeliveryService = customerDeliveryService;
    }
    async createCustomerDeliveryInfo(deliveryInfo) {
        return this.customerDeliveryService.createOrUpdateDeliveryInfo(deliveryInfo);
    }
};
exports.CustomerDeliveryController = CustomerDeliveryController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerDeliveryController.prototype, "createCustomerDeliveryInfo", null);
exports.CustomerDeliveryController = CustomerDeliveryController = __decorate([
    (0, common_1.Controller)("customer-delivery"),
    __metadata("design:paramtypes", [customer_delivery_service_1.CustomerDeliveryService])
], CustomerDeliveryController);
//# sourceMappingURL=customer-delivery.controller.js.map