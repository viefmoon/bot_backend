import { prisma } from "../../server";
import logger from "../../common/utils/logger";
import { SchedulingService } from "./services/SchedulingService";
import { ProductCalculationService } from "./services/ProductCalculationService";
import { DeliveryInfoService } from "./services/DeliveryInfoService";
import { RestaurantService } from "../restaurant/RestaurantService";
import { OrderType } from "@prisma/client";

export class PreOrderService {
  /**
   * Create a preorder with selected products
   */
  async createPreOrder(orderData: {
    orderItems: any[];
    whatsappPhoneNumber: string;
    orderType: OrderType;
    scheduledAt?: string | Date;
    deliveryInfo?: any;
  }) {
    const { orderItems, whatsappPhoneNumber, orderType, scheduledAt, deliveryInfo: inputDeliveryInfo } = orderData;

    logger.info(`Starting createPreOrder for ${whatsappPhoneNumber}`, {
      orderType,
      itemCount: orderItems.length,
      scheduledAt,
      items: JSON.stringify(orderItems)
    });

    try {
      // Get restaurant config
      const config = await RestaurantService.getConfig();

      // Convert OrderType enum to string
      const orderTypeString = orderType === 'DELIVERY' ? 'delivery' : orderType === 'TAKE_AWAY' ? 'pickup' : 'pickup';

      // Validate scheduled time if provided
      const validatedScheduledTime = await SchedulingService.validateScheduledTime(
        scheduledAt,
        orderTypeString
      );

      // Get customerId from whatsapp phone number for delivery info
      const customer = await prisma.customer.findUnique({
        where: { whatsappPhoneNumber }
      });
      
      // Get or create delivery info
      if (customer) {
        await DeliveryInfoService.getOrCreateDeliveryInfo(
          orderTypeString,
          customer.id,
          inputDeliveryInfo
        );
      }

      // Calculate items and total cost
      const { items: calculatedItems, totalCost } = await ProductCalculationService.calculateOrderItems(
        orderItems
      );

      // Create pre-order data without messageId (will be added after WhatsApp message is sent)
      const preOrderData: any = {
        whatsappPhoneNumber,
        orderType,
        orderItems: JSON.parse(JSON.stringify(calculatedItems)), // Convert to JSON-compatible format
      };
      
      // Only add scheduledAt if it exists and is valid
      if (validatedScheduledTime) {
        preOrderData.scheduledAt = validatedScheduledTime;
      }
      
      logger.info('Creating pre-order with data:', {
        whatsappPhoneNumber: preOrderData.whatsappPhoneNumber,
        orderType: preOrderData.orderType,
        scheduledAt: preOrderData.scheduledAt,
        itemCount: calculatedItems.length,
        totalCost
      });
      
      // Create pre-order
      const preOrder = await prisma.preOrder.create({
        data: preOrderData,
      });

      logger.info(`Created pre-order ${preOrder.id} for phone ${whatsappPhoneNumber}`, {
        preOrderId: preOrder.id,
        createdAt: preOrder.createdAt
      });

      // Get delivery info if it's a delivery order
      let deliveryInfo = null;
      if (orderType === 'DELIVERY' && customer) {
        const customerWithAddresses = await prisma.customer.findUnique({
          where: { id: customer.id },
          include: { addresses: { where: { deletedAt: null } } }
        });
        
        if (customerWithAddresses?.addresses?.[0]) {
          deliveryInfo = customerWithAddresses.addresses[0];
        }
      }

      return {
        preOrderId: preOrder.id,
        orderType,
        items: calculatedItems,
        total: totalCost,
        deliveryInfo,
        scheduledAt: validatedScheduledTime,
        estimatedPickupTime: config.estimatedPickupTime,
        estimatedDeliveryTime: config.estimatedDeliveryTime,
      };
    } catch (error) {
      logger.error("Error in createPreOrder:", error);
      throw error;
    }
  }

  /**
   * Update delivery info for a preorder
   */
  async updateDeliveryInfo(preOrderId: number, deliveryInfo: any): Promise<void> {
    await DeliveryInfoService.updatePreOrderDeliveryInfo(preOrderId, deliveryInfo);
  }

}