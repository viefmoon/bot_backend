import { Controller, Put, Body } from "@nestjs/common";
import { OrderStatusService } from "../services/order-status.service";
import { UpdateOrderStatusDto } from "../dto/update-order-status.dto";

@Controller("order-status")
export class OrderStatusController {
  constructor(private readonly orderStatusService: OrderStatusService) {}

  @Put()
  async updateOrderStatus(@Body() updateOrderStatusDto: UpdateOrderStatusDto) {
    return this.orderStatusService.updateOrderStatus(updateOrderStatusDto);
  }
}
