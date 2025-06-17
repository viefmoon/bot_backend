import logger from "../../../common/utils/logger";
import { sendWhatsAppMessage } from "../../../services/whatsapp";
import { OTPService } from "../../../services/security/OTPService";
import { env } from "../../../common/config/envValidator";
import { ErrorService, BusinessLogicError, ErrorCode } from "../../../common/services/errors";
import { OrderManagementService } from "../../../orders/services/OrderManagementService";

export async function handleOrderModification(
  from: string,
  messageId: string
): Promise<void> {
  try {
    logger.info(
      `handleOrderModification called with from: ${from}, messageId: ${messageId}`
    );

    const orderManagementService = new OrderManagementService();
    const order = await orderManagementService.getOrderByMessageId(messageId);

    if (!order) {
      throw new BusinessLogicError(ErrorCode.ORDER_NOT_FOUND, 'Order not found for modification', { userId: from, operation: 'handleOrderModification', metadata: { messageId } });
    }

    logger.info(`Found order: ${order.id} with status: ${order.status}`);

    // Check if order can be modified
    const canModify = await orderManagementService.canModifyOrder(order.id);
    if (!canModify) {
      throw new BusinessLogicError(ErrorCode.ORDER_CANNOT_MODIFY, 'Cannot modify order with status: ${order.status}', { userId: from, orderId: order.id, metadata: { orderStatus: order.status } });
    }

    // Generar un OTP para la modificación
    const otp = OTPService.generateOTP();
    OTPService.storeOTP(from, otp);

    const modificationLink = `${env.FRONTEND_BASE_URL}/modify-order/${order.id}?otp=${otp}`;

    const message = `📝 Para modificar tu orden #${order.dailyOrderNumber}, haz clic en el siguiente enlace:

🔗 ${modificationLink}

⏱️ Este enlace es válido por 10 minutos.

⚠️ Solo puedes modificar tu orden mientras esté pendiente de confirmación.`;

    await sendWhatsAppMessage(from, message);
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handleOrderModification',
      metadata: { messageId }
    });
  }
}