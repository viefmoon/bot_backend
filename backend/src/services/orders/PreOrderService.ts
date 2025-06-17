import { prisma } from "../../server";
import logger from "../../common/utils/logger";
import { SchedulingService } from "./services/SchedulingService";
import { ProductCalculationService } from "./services/ProductCalculationService";
import { DeliveryInfoService } from "./services/DeliveryInfoService";
import { RestaurantService } from "../restaurant/RestaurantService";
import { NotFoundError, ErrorCode } from "../../common/services/errors";
import { OrderType } from "@prisma/client";

export class PreOrderService {
  /**
   * Create a preorder with selected products
   */
  async selectProducts(orderData: {
    orderItems: any[];
    customerId: string;
    orderType: OrderType;
    scheduledDeliveryTime?: string | Date;
    deliveryInfo?: any;
  }) {
    const { orderItems, customerId, orderType, scheduledDeliveryTime, deliveryInfo } = orderData;

    try {
      // Get restaurant config
      const config = await RestaurantService.getConfig();

      // Validate scheduled time if provided
      const validatedScheduledTime = await SchedulingService.validateScheduledTime(
        scheduledDeliveryTime,
        orderType
      );

      // Get or create delivery info
      const orderDeliveryInfo = await DeliveryInfoService.getOrCreateDeliveryInfo(
        orderType,
        customerId,
        deliveryInfo
      );

      // Calculate items and total cost
      const { items: calculatedItems, totalCost } = await ProductCalculationService.calculateOrderItems(
        orderItems
      );

      // Create pre-order
      const preOrder = await prisma.preOrder.create({
        data: {
          customerId,
          orderType,
          orderItems: JSON.parse(JSON.stringify(calculatedItems)), // Convert to JSON-compatible format
          scheduledDeliveryTime: validatedScheduledTime,
          messageId: `preorder_${customerId}_${Date.now()}`,
        },
      });

      logger.info(`Created pre-order ${preOrder.id} for customer ${customerId}`);

      return {
        preOrderId: preOrder.id,
        selectedProducts: {
          items: calculatedItems,
          totalCost,
          estimatedPickupTime: config.estimatedPickupTime,
          estimatedDeliveryTime: config.estimatedDeliveryTime,
        }
      };
    } catch (error) {
      logger.error("Error in selectProducts:", error);
      throw error;
    }
  }

  /**
   * Update delivery info for a preorder
   */
  async updateDeliveryInfo(preOrderId: number, deliveryInfo: any): Promise<void> {
    await DeliveryInfoService.updatePreOrderDeliveryInfo(preOrderId, deliveryInfo);
  }

  /**
   * Get preorder summary
   */
  async getPreOrderSummary(preOrderId: number): Promise<any> {
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        deliveryInfo: true
      }
    });

    if (!preOrder) {
      throw new NotFoundError(
        ErrorCode.ORDER_NOT_FOUND,
        "PreOrder not found",
        { metadata: { preOrderId } }
      );
    }

    // Calculate total cost from orderItems
    const orderItems = preOrder.orderItems as any[];
    const totalCost = orderItems.reduce((total, item) => total + (item.subtotal || 0), 0);

    return {
      id: preOrder.id,
      customerId: preOrder.customerId,
      orderType: preOrder.orderType,
      orderItems: orderItems,
      totalCost: totalCost,
      scheduledDeliveryTime: preOrder.scheduledDeliveryTime,
      deliveryInfo: preOrder.deliveryInfo
    };
  }
}