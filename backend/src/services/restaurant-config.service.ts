import { RestaurantConfig } from "../models";

export class RestaurantConfigService {
  async getConfig() {
    return await RestaurantConfig.findOne();
  }
}