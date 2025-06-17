import { prisma } from "../../../server";
import { Order, OrderStatus, PreOrder } from "@prisma/client";
import logger from "../../../common/utils/logger";
import { BusinessLogicError, ValidationError, ErrorCode } from "../../../common/services/errors";
import { OrderService } from "../OrderService";
import { CreateOrderDto } from "../dto/create-order.dto";

export class OrderManagementService {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  /**
   * Convert a preorder to a confirmed order
   */
  async confirmPreOrder(preOrderId: number): Promise<Order> {
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        deliveryInfo: true,
      },
    });

    if (!preOrder) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'PreOrder not found',
        { metadata: { preOrderId } }
      );
    }

    // Build order items from preOrder.orderItems JSON
    const orderItems = (preOrder.orderItems as any[]).map((item) => ({
      productId: item.productId,
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      comments: item.comments,
      selectedModifiers: item.selectedModifiers || [],
      selectedPizzaIngredients: item.selectedPizzaIngredients || [],
    }));

    // Build delivery info if exists
    let deliveryInfo = undefined;
    if (preOrder.deliveryInfo && preOrder.deliveryInfo.length > 0) {
      const info = preOrder.deliveryInfo[0];
      deliveryInfo = {
        streetAddress: info.streetAddress,
        neighborhood: info.neighborhood,
        postalCode: info.postalCode,
        city: info.city,
        state: info.state,
        country: info.country,
        latitude: info.latitude,
        longitude: info.longitude,
        pickupName: info.pickupName,
        geocodedAddress: info.geocodedAddress,
        additionalDetails: info.additionalDetails,
      };
    }

    const orderData: CreateOrderDto = {
      orderItems,
      customerId: preOrder.customerId,
      orderType: preOrder.orderType,
      scheduledDeliveryTime: preOrder.scheduledDeliveryTime ? preOrder.scheduledDeliveryTime.toISOString() : undefined,
      orderDeliveryInfo: deliveryInfo,
    };

    // Create the order
    const order = await this.orderService.create(orderData);

    // Delete the preorder after successful confirmation
    await prisma.preOrder.delete({ where: { id: preOrderId } });

    logger.info(`PreOrder ${preOrderId} converted to Order ${order.id}`);
    return order;
  }

  /**
   * Cancel an order if it's in a cancellable state
   */
  async cancelOrder(orderId: number): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'Order not found',
        { orderId }
      );
    }

    const cancellableStatuses: OrderStatus[] = ["created", "accepted"];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BusinessLogicError(ErrorCode.ORDER_CANNOT_CANCEL, 'Cannot cancel order with status: ${order.status}', { metadata: { orderId, currentStatus: order.status } });
    }

    const cancelledOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'canceled' },
    });

    logger.info(`Order ${orderId} cancelled successfully`);
    return cancelledOrder;
  }

  /**
   * Check if an order can be modified
   */
  async canModifyOrder(orderId: number): Promise<boolean> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'Order not found',
        { orderId }
      );
    }

    const modifiableStatuses: OrderStatus[] = ["created", "accepted"];
    return modifiableStatuses.includes(order.status);
  }

  /**
   * Get order by message ID
   */
  async getOrderByMessageId(messageId: string): Promise<Order | null> {
    return await prisma.order.findFirst({
      where: { messageId },
      include: {
        orderItems: {
          include: {
            product: true,
            productVariant: true,
            selectedModifiers: {
              include: { modifier: true },
            },
            selectedPizzaIngredients: {
              include: { pizzaIngredient: true },
            },
          },
        },
        deliveryInfo: true,
      },
    });
  }

  /**
   * Get preorder by message ID
   */
  async getPreOrderByMessageId(messageId: string): Promise<PreOrder | null> {
    return await prisma.preOrder.findFirst({
      where: { messageId },
      include: {
        deliveryInfo: true,
      },
    });
  }

  /**
   * Update order message ID for tracking
   */
  async updateOrderMessageId(orderId: number, messageId: string): Promise<void> {
    await prisma.order.update({
      where: { id: orderId },
      data: { messageId },
    });
  }

  /**
   * Discard a preorder
   */
  async discardPreOrder(preOrderId: number): Promise<void> {
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
    });

    if (!preOrder) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'PreOrder not found',
        { metadata: { preOrderId } }
      );
    }

    await prisma.preOrder.delete({
      where: { id: preOrderId },
    });

    logger.info(`PreOrder ${preOrderId} discarded successfully`);
  }
}