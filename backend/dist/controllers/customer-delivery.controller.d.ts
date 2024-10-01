import { CustomerDeliveryService } from "../services/customer-delivery.service";
export declare class CustomerDeliveryController {
    private readonly customerDeliveryService;
    constructor(customerDeliveryService: CustomerDeliveryService);
    createCustomerDeliveryInfo(deliveryInfo: any): Promise<any>;
}
