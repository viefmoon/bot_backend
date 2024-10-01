export declare class RestaurantConfigService {
    getConfig(): Promise<{
        acceptingOrders: any;
        estimatedPickupTime: any;
        estimatedDeliveryTime: any;
    }>;
    updateConfig(configData: any): Promise<{
        acceptingOrders: any;
        estimatedPickupTime: any;
        estimatedDeliveryTime: any;
    }>;
}
