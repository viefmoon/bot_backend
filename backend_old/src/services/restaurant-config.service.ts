import { Injectable, NotFoundException } from "@nestjs/common";
import { RestaurantConfig } from "../models";

@Injectable()
export class RestaurantConfigService {
  async getConfig() {
    const config = await RestaurantConfig.findOne();
    if (!config) {
      throw new NotFoundException("Configuración no encontrada");
    }
    return {
      acceptingOrders: config.acceptingOrders,
      estimatedPickupTime: config.estimatedPickupTime,
      estimatedDeliveryTime: config.estimatedDeliveryTime,
    };
  }

  async updateConfig(configData: any) {
    const config = await RestaurantConfig.findOne();
    if (!config) {
      throw new NotFoundException("Configuración no encontrada");
    }
    await config.update(configData);
    return this.getConfig();
  }
}
