import { CreateOrderDto } from "../dto/create-order.dto";
export declare class OrderService {
    getOrders(date?: string): Promise<any>;
    getOrdersByClient(clientId: string): Promise<any>;
    createOrder(createOrderDto: CreateOrderDto): Promise<any>;
}
