import { prisma } from "../../server";
import { Order, OrderStatus, PreOrder } from "@prisma/client";
import logger from "../../common/utils/logger";
import { BusinessLogicError, ValidationError, ErrorCode } from "../../common/services/errors";
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
        selectedProducts: {
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

    if (!preOrder) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'PreOrder not found',
        { preOrderId }
      );
    }

    // Build order items from selected products
    const orderItems = preOrder.selectedProducts.map((sp) => ({
      productId: sp.productId,
      productVariantId: sp.productVariantId,
      quantity: sp.quantity,
      comments: sp.comments,
      selectedModifiers: sp.selectedModifiers.map((sm) => sm.modifierId),
      selectedPizzaIngredients: sp.selectedPizzaIngredients.map((spi) => ({
        pizzaIngredientId: spi.pizzaIngredientId,
        half: spi.half,
        action: spi.action,
      })),
    }));

    // Build delivery info if exists
    let deliveryInfo = undefined;
    if (preOrder.deliveryInfo) {
      deliveryInfo = {
        streetAddress: preOrder.deliveryInfo.streetAddress,
        neighborhood: preOrder.deliveryInfo.neighborhood,
        postalCode: preOrder.deliveryInfo.postalCode,
        city: preOrder.deliveryInfo.city,
        state: preOrder.deliveryInfo.state,
        country: preOrder.deliveryInfo.country,
        latitude: preOrder.deliveryInfo.latitude,
        longitude: preOrder.deliveryInfo.longitude,
        pickupName: preOrder.deliveryInfo.pickupName,
        geocodedAddress: preOrder.deliveryInfo.geocodedAddress,
        additionalDetails: preOrder.deliveryInfo.additionalDetails,
      };
    }

    const orderData: CreateOrderDto = {
      orderItems,
      customerId: preOrder.customerId,
      orderType: preOrder.orderType,
      estimatedTime: preOrder.estimatedTime,
      scheduledDeliveryTime: preOrder.scheduledDeliveryTime,
      deliveryInfo,
    };

    // Create the order
    const order = await this.orderService.createOrder(orderData);

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

    const cancellableStatuses: OrderStatus[] = ["created", "pending"];
    if (!cancellableStatuses.includes(order.status)) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_CANNOT_CANCEL,
        `Cannot cancel order with status: ${order.status}`,
        { orderId, currentStatus: order.status }
      );
    }

    const cancelledOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: "cancelled" },
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

    const modifiableStatuses: OrderStatus[] = ["created", "pending"];
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
        selectedProducts: true,
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
        { preOrderId }
      );
    }

    await prisma.preOrder.delete({
      where: { id: preOrderId },
    });

    logger.info(`PreOrder ${preOrderId} discarded successfully`);
  }
}