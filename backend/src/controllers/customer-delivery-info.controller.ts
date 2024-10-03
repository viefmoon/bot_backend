import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  NotFoundException,
} from "@nestjs/common";
import { CustomerDeliveryInfoService } from "../services/customer-delivery-info.service";

@Controller("customer-delivery-info")
export class CustomerDeliveryInfoController {
  constructor(
    private readonly customerDeliveryInfoService: CustomerDeliveryInfoService
  ) {}

  @Post()
  async createCustomerDeliveryInfo(@Body() deliveryInfo: any) {
    return this.customerDeliveryInfoService.createDeliveryInfo(deliveryInfo);
  }

  @Put(":clientId")
  async updateCustomerDeliveryInfo(
    @Param("clientId") clientId: string,
    @Body() deliveryInfo: any
  ) {
    const updatedInfo =
      await this.customerDeliveryInfoService.updateDeliveryInfo(
        clientId,
        deliveryInfo
      );
    if (!updatedInfo) {
      throw new NotFoundException(
        `No se encontró información de entrega para el cliente con ID ${clientId}`
      );
    }
    return updatedInfo;
  }

  @Get(":clientId")
  async getCustomerDeliveryInfo(@Param("clientId") clientId: string) {
    const deliveryInfo = await this.customerDeliveryInfoService.getDeliveryInfo(
      clientId
    );
    if (!deliveryInfo) {
      throw new NotFoundException(
        `No se encontró información de entrega para el cliente con ID ${clientId}`
      );
    }
    return deliveryInfo;
  }
}
