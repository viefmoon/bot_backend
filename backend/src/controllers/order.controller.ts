import { Controller, Get, Query, Param, Post, Body, Put } from "@nestjs/common";
import { OrderService } from "../services/order.service";
import { CreateOrderDto } from "src/dto/create-order.dto";
import { OrderStatus } from "src/services/order.service";

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async getOrders(
    @Query("date") date?: string,
    @Query("status") status?: OrderStatus
  ) {
    return this.orderService.getOrders(date, status);
  }

  @Get(":clientId")
  async getOrdersByClient(@Param("clientId") clientId: string) {
    return this.orderService.getOrdersByClient(clientId);
  }

  @Post()
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.createOrder(createOrderDto);
  }

  @Put("update-status")
  async updateOrderStatus(
    @Body() updateStatusDto: { orderId: number; status: OrderStatus }
  ) {
    return this.orderService.updateOrderStatus(
      updateStatusDto.orderId,
      updateStatusDto.status
    );
  }

  @Get("unsynced")
  async getUnsyncedOrders() {
    console.log("getUnsyncedOrders");
    return this.orderService.getUnsyncedOrders();
  }

  @Post("sync")
  async syncOrder(@Body() syncData: { orderId: number; localId: number }) {
    return this.orderService.updateOrderSyncStatus(
      syncData.orderId,
      syncData.localId
    );
  }
}
