import { OrderStatusService } from "../services/order-status.service";
import { UpdateOrderStatusDto } from "../dto/update-order-status.dto";
export declare class OrderStatusController {
    private readonly orderStatusService;
    constructor(orderStatusService: OrderStatusService);
    updateOrderStatus(updateOrderStatusDto: UpdateOrderStatusDto): Promise<{
        message: string;
        order: any;
    }>;
}
