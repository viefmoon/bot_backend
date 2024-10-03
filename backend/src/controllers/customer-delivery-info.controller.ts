import { Controller, Post, Body } from "@nestjs/common";
import { CustomerDeliveryInfoService } from "../services/customer-delivery-info.service";

@Controller("customer-delivery-info")
export class CustomerDeliveryInfoController {
  constructor(
    private readonly customerDeliveryInfoService: CustomerDeliveryInfoService
  ) {}

  @Post()
  async createCustomerDeliveryInfo(@Body() deliveryInfo: any) {
    return this.customerDeliveryInfoService.createOrUpdateDeliveryInfo(
      deliveryInfo
    );
  }
}
