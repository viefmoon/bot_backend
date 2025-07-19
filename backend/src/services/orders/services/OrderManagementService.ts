import { prisma } from '../../../lib/prisma';
import { Order, OrderStatus } from "@prisma/client";
import logger from "../../../common/utils/logger";
import { BusinessLogicError, ErrorCode } from "../../../common/services/errors";
import { OrderService } from "../OrderService";
import { CreateOrderDto } from '../../../dto/order';
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

    // Usar el deliveryInfo del preOrder si existe
    let deliveryInfo = undefined;
    if (preOrder.deliveryInfo) {
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
    orderId: string
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


      const formattedOrder = OrderFormattingService.formatOrderForWhatsApp(fullOrder, whatsappNumber);
      const orderSummary = await OrderFormattingService.generateConfirmationMessage(fullOrder, formattedOrder);
      
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
                  id: `pay_online:${fullOrder.id}`,
                  title: "💳 Pagar en línea",
                },
              },
            ],
          },
        };

        await WhatsAppService.sendInteractiveMessage(whatsappNumber, message);
      } else {
        await sendWhatsAppMessage(whatsappNumber, orderSummary);
      }
    } catch (error) {
      logger.error('Error sending order confirmation:', error);
      throw error;
    }
  }

  // Removed _sendOrderActionButtons - functionality integrated into sendOrderConfirmation
}