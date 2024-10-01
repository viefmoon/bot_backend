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
exports.RestaurantConfigController = void 0;
const common_1 = require("@nestjs/common");
const restaurant_config_service_1 = require("../services/restaurant-config.service");
let RestaurantConfigController = class RestaurantConfigController {
    constructor(restaurantConfigService) {
        this.restaurantConfigService = restaurantConfigService;
    }
    async getConfig() {
        return this.restaurantConfigService.getConfig();
    }
    async updateConfig(config) {
        return this.restaurantConfigService.updateConfig(config);
    }
};
exports.RestaurantConfigController = RestaurantConfigController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RestaurantConfigController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RestaurantConfigController.prototype, "updateConfig", null);
exports.RestaurantConfigController = RestaurantConfigController = __decorate([
    (0, common_1.Controller)("restaurant-config"),
    __metadata("design:paramtypes", [restaurant_config_service_1.RestaurantConfigService])
], RestaurantConfigController);
//# sourceMappingURL=restaurant-config.controller.js.map