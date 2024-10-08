import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  NotFoundException,
  Query,
} from "@nestjs/common";
import { CustomerDeliveryInfoService } from "../services/customer-delivery-info.service";
import { PreOrderService } from "../services/pre-order.service";

@Controller("customer-delivery-info")
export class CustomerDeliveryInfoController {
  constructor(
    private readonly customerDeliveryInfoService: CustomerDeliveryInfoService,
    private readonly preOrderService: PreOrderService
  ) {}

  @Post()
  async createCustomerDeliveryInfo(@Body() deliveryInfo: any) {
    return this.customerDeliveryInfoService.createDeliveryInfo(deliveryInfo);
  }

  @Put(":clientId")
  async updateCustomerDeliveryInfo(
    @Param("clientId") clientId: string,
    @Body() deliveryInfo: any,
    @Query("preOrderId") preOrderId?: string
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

    if (preOrderId) {
      // Obtener la preorden existente
      const existingPreOrder = await this.preOrderService.getPreOrderById(
        preOrderId
      );
      if (!existingPreOrder) {
        throw new NotFoundException(
          `No se encontró la preorden con ID ${preOrderId}`
        );
      }

      // Regenerar la preorden utilizando select-products
      const regeneratedPreOrder = await this.preOrderService.selectProducts({
        orderItems: existingPreOrder.orderItems,
        clientId: clientId,
        orderType: existingPreOrder.orderType,
        scheduledDeliveryTime: existingPreOrder.scheduledDeliveryTime,
      });

      return {
        updatedInfo,
      };
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
