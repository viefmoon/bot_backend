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

  @Put(":customerId")
  async updateCustomerDeliveryInfo(
    @Param("customerId") customerId: string,
    @Body() deliveryInfo: any,
    @Query("preOrderId") preOrderId?: string
  ) {
    const updatedInfo =
      await this.customerDeliveryInfoService.updateDeliveryInfo(
        customerId,
        deliveryInfo
      );
    if (!updatedInfo) {
      throw new NotFoundException(
        `No se encontró información de entrega para el cliente con ID ${customerId}`
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
        customerId: customerId,
        orderType: existingPreOrder.orderType,
        scheduledDeliveryTime: existingPreOrder.scheduledDeliveryTime,
      });

      return updatedInfo;
    }

    return updatedInfo;
  }

  @Get(":customerId")
  async getCustomerDeliveryInfo(@Param("customerId") customerId: string) {
    console.log("customerId", customerId);
    const deliveryInfo = await this.customerDeliveryInfoService.getDeliveryInfo(
      customerId
    );
    if (!deliveryInfo) {
      throw new NotFoundException(
        `No se encontró información de entrega para el cliente con ID ${customerId}`
      );
    }
    return deliveryInfo;
  }
}
