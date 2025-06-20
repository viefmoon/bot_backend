import { prisma } from "../../../server";
import { Order, OrderStatus, PreOrder } from "@prisma/client";
import logger from "../../../common/utils/logger";
import { BusinessLogicError, ErrorCode } from "../../../common/services/errors";
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
        street: info.street || undefined,
        number: info.number || undefined,
        interiorNumber: info.interiorNumber || undefined,
        neighborhood: info.neighborhood || undefined,
        zipCode: info.zipCode || undefined,
        city: info.city || undefined,
        state: info.state || undefined,
        country: info.country || undefined,
        latitude: info.latitude ? info.latitude.toNumber() : undefined,
        longitude: info.longitude ? info.longitude.toNumber() : undefined,
        pickupName: info.pickupName || undefined,
        references: info.references || undefined,
      };
    }

    // Get customer by WhatsApp phone number
    const customer = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: preOrder.whatsappPhoneNumber }
    });

    if (!customer) {
      throw new BusinessLogicError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found for this phone number',
        { metadata: { whatsappPhoneNumber: preOrder.whatsappPhoneNumber } }
      );
    }

    const orderData: CreateOrderDto = {
      orderItems,
      customerId: customer.id,
      orderType: preOrder.orderType,
      scheduledAt: preOrder.scheduledAt ? preOrder.scheduledAt.toISOString() : undefined,
      ...(deliveryInfo ? { orderDeliveryInfo: deliveryInfo } : {}),
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
  async cancelOrder(orderId: string): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'Order not found',
        { metadata: { orderId } }
      );
    }

    const cancellableStatuses: OrderStatus[] = ["PENDING", "IN_PROGRESS"];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      throw new BusinessLogicError(ErrorCode.ORDER_CANNOT_CANCEL, 'Cannot cancel order with status: ${order.orderStatus}', { metadata: { orderId, currentStatus: order.orderStatus } });
    }

    const cancelledOrder = await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: 'CANCELLED' },
    });

    logger.info(`Order ${orderId} cancelled successfully`);
    return cancelledOrder;
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
            productModifiers: true,
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
  async updateOrderMessageId(orderId: string, messageId: string): Promise<void> {
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