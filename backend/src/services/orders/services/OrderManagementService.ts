import { prisma } from "../../../server";
import { Order, OrderStatus, PreOrder } from "@prisma/client";
import logger from "../../../common/utils/logger";
import { BusinessLogicError, ErrorCode } from "../../../common/services/errors";
import { OrderService } from "../OrderService";
import { CreateOrderDto } from "../dto/create-order.dto";
import { sendWhatsAppMessage, WhatsAppService } from "../../whatsapp";
import { OrderFormattingService } from "./OrderFormattingService";
import { SyncMetadataService } from "../../sync/SyncMetadataService";

export class OrderManagementService {
  async confirmPreOrder(preOrderId: number): Promise<Order> {
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        deliveryInfo: true,
        orderItems: {
          include: {
            product: true,
            productVariant: true,
            productModifiers: true,
            selectedPizzaCustomizations: {
              include: {
                pizzaCustomization: true
              }
            }
          }
        }
      },
    });

    if (!preOrder) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'PreOrder not found',
        { metadata: { preOrderId } }
      );
    }

    const orderItems = preOrder.orderItems.map(item => ({
      productId: item.productId,
      productVariantId: item.productVariantId,
      selectedModifiers: item.productModifiers.map(m => m.id),
      selectedPizzaCustomizations: item.selectedPizzaCustomizations.map(sc => ({
        pizzaCustomizationId: sc.pizzaCustomizationId,
        half: sc.half,
        action: sc.action
      })),
      quantity: 1
    }));

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

    const orderItemsDto = orderItems.map(item => ({
      productId: item.productId,
      productVariantId: item.productVariantId || undefined,
      quantity: item.quantity,
      comments: undefined,
      selectedModifiers: item.selectedModifiers || [],
      selectedPizzaCustomizations: (item.selectedPizzaCustomizations || []).map(pc => ({
        pizzaCustomizationId: pc.pizzaCustomizationId,
        half: pc.half,
        action: pc.action
      }))
    }));

    const orderData: CreateOrderDto = {
      orderItems: orderItemsDto,
      whatsappPhoneNumber: customer.whatsappPhoneNumber,
      orderType: preOrder.orderType,
      scheduledAt: preOrder.scheduledAt ? preOrder.scheduledAt.toISOString() : undefined,
      subtotal: preOrder.subtotal,
      total: preOrder.total,
      ...(deliveryInfo ? { deliveryInfo: deliveryInfo } : {}),
    };

    const order = await OrderService.create(orderData);

    await prisma.preOrder.delete({ where: { id: preOrderId } });

    logger.info(`PreOrder ${preOrderId} converted to Order ${order.id}`);
    
    await SyncMetadataService.markForSync('Order', order.id, 'REMOTE');
    
    try {
      const { SyncNotificationService } = await import('../../sync/SyncNotificationService');
      await SyncNotificationService.notifyNewOrder(order.id);
    } catch (error) {
      logger.warn('Could not notify sync service about new order:', error);
    }
    
    return order;
  }

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
    
    await SyncMetadataService.markForSync('Order', orderId, 'REMOTE');
    
    return cancelledOrder;
  }

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

  async getPreOrderByMessageId(messageId: string): Promise<PreOrder | null> {
    return await prisma.preOrder.findFirst({
      where: { messageId },
      include: {
        deliveryInfo: true,
      },
    });
  }

  async updateOrderMessageId(orderId: string, messageId: string): Promise<void> {
    await prisma.order.update({
      where: { id: orderId },
      data: { messageId },
    });
  }

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

  async sendOrderConfirmation(
    whatsappNumber: string,
    orderId: string,
    _action: "confirmed" | "cancelled" | "modified" = "confirmed"
  ): Promise<void> {
    try {
      const fullOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
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

      const newMessageId = `order_${fullOrder.id}_${Date.now()}`;
      await this.updateOrderMessageId(fullOrder.id, newMessageId);

      const formattedOrder = OrderFormattingService.formatOrderForWhatsApp(fullOrder, whatsappNumber);
      const orderSummary = OrderFormattingService.generateConfirmationMessage(fullOrder, formattedOrder);
      
      if (fullOrder.orderStatus === "PENDING" || fullOrder.orderStatus === "IN_PROGRESS") {
        const message = {
          type: "button",
          header: {
            type: "text",
            text: "✅ Orden Confirmada",
          },
          body: {
            text: orderSummary,
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
                  title: "💳 Pagar en línea",
                },
              },
            ],
          },
        };

        await WhatsAppService.sendInteractiveMessage(whatsappNumber, message, fullOrder.messageId || newMessageId);
      } else {
        await sendWhatsAppMessage(whatsappNumber, orderSummary);
      }
    } catch (error) {
      logger.error('Error sending order confirmation:', error);
      throw error;
    }
  }

  private async _sendOrderActionButtons(
    whatsappNumber: string,
    messageId: string,
    orderStatus: OrderStatus
  ): Promise<void> {
    try {
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
                  title: "💳 Pagar en línea",
                },
              },
            ],
          },
        };

        await WhatsAppService.sendInteractiveMessage(whatsappNumber, message, messageId);
      }
    } catch (error) {
      logger.error('Error sending action buttons:', error);
    }
  }
}