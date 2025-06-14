import { RestaurantConfig } from "../../database/entities";

export class RestaurantConfigService {
  async getConfig() {
    return await RestaurantConfig.findOne();
  }
}