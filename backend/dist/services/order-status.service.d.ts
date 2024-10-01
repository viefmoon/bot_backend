import { UpdateOrderStatusDto } from "../dto/update-order-status.dto";
export declare class OrderStatusService {
    private readonly statusMessages;
    updateOrderStatus(updateOrderStatusDto: UpdateOrderStatusDto): Promise<{
        message: string;
        order: any;
    }>;
}
