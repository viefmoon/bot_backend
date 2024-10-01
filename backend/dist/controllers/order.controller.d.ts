import { OrderService } from "../services/order.service";
import { CreateOrderDto } from "src/dto/create-order.dto";
export declare class OrderController {
    private readonly orderService;
    constructor(orderService: OrderService);
    getOrders(date: string): Promise<any>;
    getOrdersByClient(clientId: string): Promise<any>;
    createOrder(createOrderDto: CreateOrderDto): Promise<any>;
}
