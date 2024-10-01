import { Controller, Post, Body } from "@nestjs/common";
import { CustomerDeliveryService } from "../services/customer-delivery.service";

@Controller("customer-delivery")
export class CustomerDeliveryController {
  constructor(
    private readonly customerDeliveryService: CustomerDeliveryService
  ) {}

  @Post()
  async createCustomerDeliveryInfo(@Body() deliveryInfo: any) {
    return this.customerDeliveryService.createOrUpdateDeliveryInfo(
      deliveryInfo
    );
  }
}
