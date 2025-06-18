import { prisma } from "../../../server";
import logger from "../../../common/utils/logger";
import { sendWhatsAppMessage, WhatsAppService } from "../../../services/whatsapp";
import { OrderManagementService } from "../../../services/orders/services/OrderManagementService";
import { OrderFormattingService } from "../../../services/orders/services/OrderFormattingService";
import { ErrorService, BusinessLogicError, ErrorCode } from "../../../common/services/errors";

// Crear la orden en el sistema
export async function handlePreOrderConfirmation(
  from: string,
  messageId: string
): Promise<void> {
  try {
    logger.info(`Starting preorder confirmation for ${from}, messageId: ${messageId}`);
    
    const orderManagementService = new OrderManagementService();
    const preOrder = await orderManagementService.getPreOrderByMessageId(messageId);

    if (!preOrder) {
      throw new BusinessLogicError(ErrorCode.ORDER_NOT_FOUND, 'PreOrder not found', { userId: from, operation: 'handlePreOrderConfirmation', metadata: { messageId } });
    }

    logger.info(`Found preorder: ${preOrder.id}`);

    // Convert preorder to order
    const order = await orderManagementService.confirmPreOrder(preOrder.id);

    logger.info(`Order created successfully: ${order.id}`);

    // Send order confirmation
    await sendOrderConfirmation(from, order.id, "confirmed");
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handlePreOrderConfirmation',
      metadata: { messageId }
    });
  }
}

// Función principal para enviar la confirmación de la orden
export async function sendOrderConfirmation(
  telefono: string,
  orderId: string,
  action: "confirmed" | "cancelled" | "modified"
): Promise<void> {
  try {
    // Obtener la orden completa con todos los detalles
    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
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

    if (!fullOrder) {
      throw new BusinessLogicError(ErrorCode.ORDER_NOT_FOUND, 'Order not found for confirmation', { userId: telefono, metadata: { orderId }, operation: 'sendOrderConfirmation' });
    }

    const orderType = fullOrder.orderType;
    let informacionEntrega = "";

    if (orderType === "DELIVERY" && fullOrder.deliveryInfo) {
      const deliveryInfo = fullOrder.deliveryInfo;
      const parts = [];
      // Construir dirección completa
      if (deliveryInfo.street && deliveryInfo.number) {
        let address = `${deliveryInfo.street} ${deliveryInfo.number}`;
        if (deliveryInfo.interiorNumber) {
          address += ` Int ${deliveryInfo.interiorNumber}`;
        }
        parts.push(address);
      }
      if (deliveryInfo.neighborhood) parts.push(deliveryInfo.neighborhood);
      if (deliveryInfo.city) parts.push(deliveryInfo.city);
      if (deliveryInfo.references) parts.push(`(${deliveryInfo.references})`);
      informacionEntrega = parts.join(", ");
    } else if (orderType === "TAKE_AWAY" && fullOrder.deliveryInfo?.pickupName) {
      informacionEntrega = fullOrder.deliveryInfo.pickupName;
    }

    // Format order for display
    const formattedOrder = OrderFormattingService.formatOrderForWhatsApp(fullOrder, telefono);
    const orderSummary = OrderFormattingService.generateConfirmationMessage(fullOrder, formattedOrder);
    
    await sendWhatsAppMessage(telefono, orderSummary);

    // Update messageId for tracking
    const orderManagementService = new OrderManagementService();
    const newMessageId = `order_${fullOrder.id}_${Date.now()}`;
    await orderManagementService.updateOrderMessageId(fullOrder.id, newMessageId);

    // Enviar botones de acción
    await sendActionButtonsForOrder(
      telefono,
      fullOrder.dailyNumber,
      fullOrder.messageId || `order_${fullOrder.id}_${Date.now()}`,
      fullOrder.orderStatus
    );
  } catch (error) {
    await ErrorService.handleAndSendError(error, telefono, {
      userId: telefono,
      metadata: { orderId },
      operation: 'sendOrderConfirmation'
    });
  }
}

// Función para enviar los botones de acción
async function sendActionButtonsForOrder(
  telefono: string,
  orderId: number,
  messageId: string,
  orderStatus: string
): Promise<void> {
  try {
    if (orderStatus === "created" || orderStatus === "pending") {
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
                id: "modify_order",
                title: "✏️ Modificar orden",
              },
            },
            {
              type: "reply",
              reply: {
                id: "online_payment",
                title: "💳 Generar enlace de pago",
              },
            },
          ],
        },
      };

      await WhatsAppService.sendInteractiveMessage(telefono, message, messageId);
    }
  } catch (error) {
    logger.error('Error sending action buttons:', error);
    // No need to notify user about button sending failure
  }
}