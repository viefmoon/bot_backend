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
    whatsappPhoneNumber: string;
    orderType: OrderType;
    scheduledAt?: string | Date;
    deliveryInfo?: any;
  }) {
    const { orderItems, whatsappPhoneNumber, orderType, scheduledAt, deliveryInfo: inputDeliveryInfo } = orderData;

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
      const orderDeliveryInfo = customer ? await DeliveryInfoService.getOrCreateDeliveryInfo(
        orderTypeString,
        customer.id,
        inputDeliveryInfo
      ) : null;

      // Calculate items and total cost
      const { items: calculatedItems, totalCost } = await ProductCalculationService.calculateOrderItems(
        orderItems
      );

      // Create pre-order
      const preOrder = await prisma.preOrder.create({
        data: {
          whatsappPhoneNumber,
          orderType,
          orderItems: JSON.parse(JSON.stringify(calculatedItems)), // Convert to JSON-compatible format
          scheduledAt: validatedScheduledTime,
          messageId: `preorder_${whatsappPhoneNumber}_${Date.now()}`,
        },
      });

      logger.info(`Created pre-order ${preOrder.id} for phone ${whatsappPhoneNumber}`);

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
      whatsappPhoneNumber: preOrder.whatsappPhoneNumber,
      orderType: preOrder.orderType,
      orderItems: orderItems,
      totalCost: totalCost,
      scheduledAt: preOrder.scheduledAt,
      deliveryInfo: preOrder.deliveryInfo
    };
  }
}