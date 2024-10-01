import { RestaurantConfigService } from "../services/restaurant-config.service";
export declare class RestaurantConfigController {
    private readonly restaurantConfigService;
    constructor(restaurantConfigService: RestaurantConfigService);
    getConfig(): Promise<{
        acceptingOrders: any;
        estimatedPickupTime: any;
        estimatedDeliveryTime: any;
    }>;
    updateConfig(config: any): Promise<{
        acceptingOrders: any;
        estimatedPickupTime: any;
        estimatedDeliveryTime: any;
    }>;
}
