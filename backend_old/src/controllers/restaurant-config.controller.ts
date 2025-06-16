import { Controller, Get, Put, Body } from "@nestjs/common";
import { RestaurantConfigService } from "../services/restaurant-config.service";

@Controller("restaurant-config")
export class RestaurantConfigController {
  constructor(
    private readonly restaurantConfigService: RestaurantConfigService
  ) {}

  @Get()
  async getConfig() {
    return this.restaurantConfigService.getConfig();
  }

  @Put()
  async updateConfig(@Body() config: any) {
    return this.restaurantConfigService.updateConfig(config);
  }
}
