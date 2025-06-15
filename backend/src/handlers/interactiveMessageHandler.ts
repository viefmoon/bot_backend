import { prisma } from '../server';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { createOrderFromPreOrder, updateOrderStatus } from '../services/orders';
import { createCheckoutSession } from '../services/stripe';
import { generateAndSendOTP, verifyOTP } from '../services/otp';
import logger from '../utils/logger';

export async function handleInteractiveMessage(
  from: string,
  interactive: any
): Promise<void> {
  const buttonReply = interactive.button_reply;
  if (!buttonReply) return;

  const buttonId = buttonReply.id;
  const messageId = interactive.response?.message_id;

  logger.info(`Interactive button pressed: ${buttonId} by ${from}`);

  try {
    switch (buttonId) {
      case 'confirm_order':
        await handleConfirmOrder(from, messageId);
        break;
      
      case 'modify_delivery':
        await handleModifyDelivery(from);
        break;
      
      case 'discard_order':
        await handleDiscardOrder(from);
        break;
      
      case 'request_otp':
        await handleRequestOTP(from);
        break;
      
      case 'pay_with_card':
        await handlePayWithCard(from, messageId);
        break;
      
      case 'pay_on_delivery':
        await handlePayOnDelivery(from, messageId);
        break;
      
      case 'cancel_order':
        await handleCancelOrder(from, messageId);
        break;
      
      default:
        await sendWhatsAppMessage(from, "Opción no reconocida. Por favor intenta de nuevo.");
    }
  } catch (error) {
    logger.error('Error handling interactive message:', error);
    await sendWhatsAppMessage(
      from,
      "Ocurrió un error procesando tu solicitud. Por favor intenta de nuevo."
    );
  }
}

async function handleConfirmOrder(customerId: string, messageId: string) {
  // Find preOrder by messageId
  const preOrder = await prisma.preOrder.findFirst({
    where: { 
      customerId,
      messageId 
    }
  });

  if (!preOrder) {
    await sendWhatsAppMessage(customerId, "No se encontró la orden para confirmar.");
    return;
  }

  // Generate OTP
  const otpSent = await generateAndSendOTP(customerId);
  if (!otpSent) {
    await sendWhatsAppMessage(
      customerId,
      "Error al enviar el código de verificación. Por favor intenta de nuevo."
    );
    return;
  }

  await sendWhatsAppMessage(
    customerId,
    "📱 Te hemos enviado un código de verificación por SMS. Por favor ingrésalo para confirmar tu orden."
  );
}

async function handleModifyDelivery(customerId: string) {
  await sendWhatsAppMessage(
    customerId,
    "Para modificar tu dirección de entrega, por favor envíame tu nueva dirección completa."
  );
}

async function handleDiscardOrder(customerId: string) {
  // Delete all preOrders for this customer
  await prisma.preOrder.deleteMany({
    where: { customerId }
  });

  await sendWhatsAppMessage(
    customerId,
    "❌ Tu orden ha sido descartada. ¿Hay algo más en lo que pueda ayudarte?"
  );
}

async function handleRequestOTP(customerId: string) {
  const otpSent = await generateAndSendOTP(customerId);
  
  if (otpSent) {
    await sendWhatsAppMessage(
      customerId,
      "📱 Te hemos enviado un nuevo código de verificación por SMS."
    );
  } else {
    await sendWhatsAppMessage(
      customerId,
      "Error al enviar el código. Por favor espera unos minutos antes de intentar de nuevo."
    );
  }
}

async function handlePayWithCard(customerId: string, messageId: string) {
  const order = await prisma.order.findFirst({
    where: { 
      customerId,
      messageId,
      status: 'created'
    }
  });

  if (!order) {
    await sendWhatsAppMessage(customerId, "No se encontró la orden para pagar.");
    return;
  }

  try {
    const session = await createCheckoutSession(
      order.id,
      order.totalCost,
      customerId
    );

    await sendWhatsAppMessage(
      customerId,
      `💳 Haz clic en el siguiente enlace para completar tu pago:\n\n${session.url}\n\nEste enlace expirará en 30 minutos.`
    );
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    await sendWhatsAppMessage(
      customerId,
      "Error al generar el enlace de pago. Por favor intenta de nuevo."
    );
  }
}

async function handlePayOnDelivery(customerId: string, messageId: string) {
  const order = await prisma.order.findFirst({
    where: { 
      customerId,
      messageId,
      status: 'created'
    }
  });

  if (!order) {
    await sendWhatsAppMessage(customerId, "No se encontró la orden para confirmar.");
    return;
  }

  // Update order status to accepted
  await prisma.order.update({
    where: { id: order.id },
    data: { 
      status: 'accepted',
      paymentStatus: 'pending'
    }
  });

  const estimatedTime = order.orderType === 'pickup' 
    ? process.env.ESTIMATED_PICKUP_TIME || '20'
    : process.env.ESTIMATED_DELIVERY_TIME || '40';

  await sendWhatsAppMessage(
    customerId,
    `✅ ¡Tu orden #${order.dailyOrderNumber} ha sido confirmada!\n\n` +
    `📍 Tipo: ${order.orderType === 'pickup' ? 'Recolección' : 'Entrega a domicilio'}\n` +
    `⏱️ Tiempo estimado: ${estimatedTime} minutos\n` +
    `💵 Pago: En efectivo al ${order.orderType === 'pickup' ? 'recoger' : 'recibir'}\n\n` +
    `Te notificaremos cuando tu orden esté lista. ¡Gracias por tu preferencia!`
  );
}

async function handleCancelOrder(customerId: string, messageId: string) {
  const order = await prisma.order.findFirst({
    where: { 
      customerId,
      messageId,
      status: { in: ['created', 'accepted'] }
    }
  });

  if (!order) {
    await sendWhatsAppMessage(customerId, "No se encontró la orden para cancelar.");
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'canceled' }
  });

  await sendWhatsAppMessage(
    customerId,
    `❌ Tu orden #${order.dailyOrderNumber} ha sido cancelada.\n\n¿Hay algo más en lo que pueda ayudarte?`
  );
}