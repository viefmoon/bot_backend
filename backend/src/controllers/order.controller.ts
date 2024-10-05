import { Controller, Get, Query, Param, Post, Body, Put } from "@nestjs/common";
import { OrderService } from "../services/order.service";
import { CreateOrderDto } from "src/dto/create-order.dto";
import { OrderStatus } from "src/services/order.service";

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

  @Put(":id/update-status")
  async updateOrderStatus(
    @Param("id") id: number,
    @Body() updateStatusDto: { status: OrderStatus }
  ) {
    return this.orderService.updateOrderStatus(id, updateStatusDto.status);
  }
}
