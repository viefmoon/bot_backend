import { sendWhatsAppMessage } from "../../../services/whatsapp";
import { ErrorService } from "../../../common/services/errors";
import { OrderManagementService } from "../../../orders/services/OrderManagementService";
import {
  ORDER_NOT_FOUND_MESSAGE,
  ORDER_CANNOT_BE_CANCELLED_MESSAGE,
  ORDER_CANCELLED_MESSAGE
} from "../../../common/config/predefinedMessages";

export async function handleOrderCancellation(
  from: string,
  messageId: string
): Promise<void> {
  try {
    const orderManagementService = new OrderManagementService();
    const order = await orderManagementService.getOrderByMessageId(messageId);

    if (!order) {
      await sendWhatsAppMessage(from, ORDER_NOT_FOUND_MESSAGE);
      return;
    }

    try {
      await orderManagementService.cancelOrder(order.id);
      await sendWhatsAppMessage(from, ORDER_CANCELLED_MESSAGE);
    } catch (error) {
      // If it's a business logic error about status, send the appropriate message
      if (error.code === 'BL003') {
        const message = ORDER_CANNOT_BE_CANCELLED_MESSAGE(order.status);
        await sendWhatsAppMessage(from, message);
        return;
      }
      throw error;
    }
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handleOrderCancellation',
      metadata: { messageId }
    });
  }
}