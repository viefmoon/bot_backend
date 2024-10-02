import { Controller, Get, Query, Param, Post, Body } from "@nestjs/common";
import { OrderService } from "../services/order.service";
import { CreateOrderDto } from "src/dto/create-order.dto";

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async getOrders(@Query("date") date: string) {
    return this.orderService.getOrders(date);
  }

  @Get(":clientId")
  async getOrdersByClient(@Param("clientId") clientId: string) {
    return this.orderService.getOrdersByClient(clientId);
  }

  @Post()
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.createOrder(createOrderDto);
  }
}
