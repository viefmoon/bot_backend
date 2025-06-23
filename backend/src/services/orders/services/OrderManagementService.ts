import { prisma } from "../../../server";
import { Order, OrderStatus, PreOrder } from "@prisma/client";
import logger from "../../../common/utils/logger";
import { BusinessLogicError, ErrorCode } from "../../../common/services/errors";
import { OrderService } from "../OrderService";
import { CreateOrderDto } from "../dto/create-order.dto";
import { sendWhatsAppMessage, WhatsAppService } from "../../whatsapp";
import { OrderFormattingService } from "./OrderFormattingService";

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
      selectedPizzaCustomizations: item.selectedPizzaCustomizations || [],
    }));

    // Build delivery info if exists
    let deliveryInfo = undefined;
    if (preOrder.deliveryInfo?.id) {
      const info = preOrder.deliveryInfo;
      deliveryInfo = {
        fullAddress: info.fullAddress || undefined,
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
        recipientName: info.recipientName || undefined,
        recipientPhone: info.recipientPhone || undefined,
        deliveryInstructions: info.deliveryInstructions || undefined,
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
      whatsappPhoneNumber: customer.whatsappPhoneNumber,
      orderType: preOrder.orderType,
      scheduledAt: preOrder.scheduledAt ? preOrder.scheduledAt.toISOString() : undefined,
      ...(deliveryInfo ? { deliveryInfo: deliveryInfo } : {}),
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
            selectedPizzaCustomizations: {
              include: { pizzaCustomization: true },
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

  /**
   * Send order confirmation with details and action buttons
   */
  async sendOrderConfirmation(
    whatsappNumber: string,
    orderId: string,
    action: "confirmed" | "cancelled" | "modified" = "confirmed"
  ): Promise<void> {
    try {
      // Get complete order details
      const fullOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: {
            include: {
              product: true,
              productVariant: true,
              productModifiers: true,
              selectedPizzaCustomizations: {
                include: { pizzaCustomization: true },
              },
            },
          },
          deliveryInfo: true,
        },
      });

      if (!fullOrder) {
        throw new BusinessLogicError(
          ErrorCode.ORDER_NOT_FOUND,
          'Order not found for confirmation',
          { metadata: { orderId } }
        );
      }

      // Format order for display
      const formattedOrder = OrderFormattingService.formatOrderForWhatsApp(fullOrder, whatsappNumber);
      const orderSummary = OrderFormattingService.generateConfirmationMessage(fullOrder, formattedOrder);
      
      // Send confirmation message
      await sendWhatsAppMessage(whatsappNumber, orderSummary);

      // Update messageId for tracking
      const newMessageId = `order_${fullOrder.id}_${Date.now()}`;
      await this.updateOrderMessageId(fullOrder.id, newMessageId);

      // Send action buttons if order is in appropriate status
      await this.sendOrderActionButtons(
        whatsappNumber,
        fullOrder.messageId || newMessageId,
        fullOrder.orderStatus
      );
    } catch (error) {
      logger.error('Error sending order confirmation:', error);
      throw error;
    }
  }

  /**
   * Send interactive buttons for order actions
   */
  private async sendOrderActionButtons(
    whatsappNumber: string,
    messageId: string,
    orderStatus: OrderStatus
  ): Promise<void> {
    try {
      // Only send buttons for pending orders
      if (orderStatus === "PENDING" || orderStatus === "IN_PROGRESS") {
        const message = {
          type: "button",
          header: {
            type: "text",
            text: "Opciones de tu orden",
          },
          body: {
            text: "¿Qué deseas hacer con tu orden?",
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "cancel_order",
                  title: "❌ Cancelar orden",
                },
              },
              {
                type: "reply",
                reply: {
                  id: "pay_online",
                  title: "💳 Generar enlace de pago",
                },
              },
            ],
          },
        };

        await WhatsAppService.sendInteractiveMessage(whatsappNumber, message, messageId);
      }
    } catch (error) {
      logger.error('Error sending action buttons:', error);
      // Don't throw - button sending failure shouldn't stop the confirmation
    }
  }
}