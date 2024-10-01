"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantConfigService = void 0;
const common_1 = require("@nestjs/common");
const models_1 = require("../models");
let RestaurantConfigService = class RestaurantConfigService {
    async getConfig() {
        const config = await models_1.RestaurantConfig.findOne();
        if (!config) {
            throw new common_1.NotFoundException("Configuración no encontrada");
        }
        return {
            acceptingOrders: config.acceptingOrders,
            estimatedPickupTime: config.estimatedPickupTime,
            estimatedDeliveryTime: config.estimatedDeliveryTime,
        };
    }
    async updateConfig(configData) {
        const config = await models_1.RestaurantConfig.findOne();
        if (!config) {
            throw new common_1.NotFoundException("Configuración no encontrada");
        }
        await config.update(configData);
        return this.getConfig();
    }
};
exports.RestaurantConfigService = RestaurantConfigService;
exports.RestaurantConfigService = RestaurantConfigService = __decorate([
    (0, common_1.Injectable)()
], RestaurantConfigService);
//# sourceMappingURL=restaurant-config.service.js.map