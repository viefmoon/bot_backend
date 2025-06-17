import {
  handlePreOrderConfirmation,
  handlePreOrderDiscard,
  handleOrderCancellation,
  handleOrderModification,
} from "./orderHandlers";

import { prisma } from "../../server";
import { sendWhatsAppMessage } from "../../services/whatsapp";
import Stripe from "stripe";
import { OTPService } from "../../services/security/OTPService";
import {
  WAIT_TIMES_MESSAGE,
  RESTAURANT_INFO_MESSAGE,
  CHATBOT_HELP_MESSAGE,
  CHANGE_DELIVERY_INFO_MESSAGE,
} from "../../common/config/predefinedMessages";
import { ProductService } from "../../services/products/ProductService";
import logger from "../../common/utils/logger";
import { getCurrentMexicoTime } from "../../common/utils/timeUtils";
import { env } from "../../common/config/envValidator";
import { ErrorService, BusinessLogicError, ErrorCode } from "../../common/services/errors";

const stripeClient = env.STRIPE_SECRET_KEY 
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-10-28.acacia",
    })
  : null;

// ProductService uses static methods, no need to instantiate

const BUTTON_ACTIONS = {
  confirm_order: handlePreOrderConfirmation,
  discard_order: handlePreOrderDiscard,
  modify_delivery: handlePreOrderDeliveryModification,
} as const;

const LIST_ACTIONS = {
  cancel_order: handleOrderCancellation,
  modify_order: handleOrderModification,
  pay_online: handleOnlinePayment,
  wait_times: handleWaitTimes,
  view_menu: sendMenu,
  restaurant_info: handleRestaurantInfo,
  chatbot_help: handleChatbotHelp,
  change_delivery_info: handleChangeDeliveryInfo,
} as const;

export async function handleInteractiveMessage(
  from: string,
  message: any
): Promise<void> {
  try {
    logger.info('Interactive message received:', JSON.stringify(message));
    
    if (!message.interactive) {
      logger.error('No interactive property in message');
      return;
    }
    
    const { type, button_reply, list_reply } = message.interactive;
    const messageId = message.context?.id || null;

    if (type === "button_reply") {
      const action =
        BUTTON_ACTIONS[button_reply.id as keyof typeof BUTTON_ACTIONS];
      if (action) await action(from, messageId);
    } else if (type === "list_reply") {
      const action = LIST_ACTIONS[list_reply.id as keyof typeof LIST_ACTIONS];
      if (action) {
        logger.info(`Executing action: ${list_reply.id}`);
        await action(from, messageId);
      } else {
        logger.error(`No action found for: ${list_reply.id}`);
      }
    }
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handleInteractiveMessage'
    });
  }
}

async function handlePreOrderDeliveryModification(
  from: string,
  messageId: string
): Promise<void> {
  try {
    const preOrder = await prisma.preOrder.findFirst({ where: { messageId } });

    if (!preOrder) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'PreOrder not found for delivery modification',
        { userId: from, operation: 'handlePreOrderDeliveryModification' }
      );
    }

    const customerId = preOrder.customerId;
    const preOrderId = preOrder.id;

    // Generar OTP y crear el enlace
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const updateLink = `${env.FRONTEND_BASE_URL}/delivery-info-registration/${customerId}?otp=${otp}&preOrderId=${preOrderId}`;
    
    // Store OTP for later verification
    OTPService.storeOTP(customerId, otp);
    
    // Enviar el mensaje con el enlace
    const message = CHANGE_DELIVERY_INFO_MESSAGE(updateLink);
    await sendWhatsAppMessage(customerId, message);
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handlePreOrderDeliveryModification'
    });
  }
}

async function handleOnlinePayment(
  customerId: string,
  messageId: string
): Promise<void> {
  try {
    if (!stripeClient) {
      throw new BusinessLogicError(
        ErrorCode.STRIPE_ERROR,
        'Stripe client not configured',
        { userId: customerId, operation: 'handleOnlinePayment' }
      );
    }
    const order = await prisma.order.findFirst({ where: { messageId } });
    if (!order) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'Order not found for payment processing',
        { userId: customerId, operation: 'handleOnlinePayment' }
      );
    }

    if (order.stripeSessionId || order.paymentStatus === "pending") {
      throw new BusinessLogicError(
        ErrorCode.PAYMENT_LINK_EXISTS,
        'Payment link already exists for this order',
        { userId: customerId, orderId: order.id, operation: 'handleOnlinePayment' }
      );
    }

    // Verificar el estado de la orden
    let mensaje: string | undefined;
    switch (order.status) {
      case "created":
      case "accepted":
        // Continuar con el proceso de pago
        break;
      case "in_preparation":
        mensaje =
          "❌ Esta orden ya está en preparación. Por favor, contacta con el restaurante para opciones de pago.";
        break;
      case "prepared":
        mensaje =
          "❌ Esta orden ya está preparada. Por favor, contacta con el restaurante para opciones de pago.";
        break;
      case "in_delivery":
        mensaje =
          "❌ Esta orden ya está en camino. Por favor, paga al repartidor o contacta con el restaurante.";
        break;
      case "canceled":
        mensaje =
          "❌ Esta orden ya ha sido cancelada y no se puede procesar el pago.";
        break;
      case "finished":
        mensaje =
          "❌ Esta orden ya ha sido finalizada y no se puede procesar el pago.";
        break;
      default:
        mensaje =
          "❌ Lo sentimos, pero no se puede procesar el pago en este momento debido al estado actual de la orden.";
    }

    if (mensaje) {
      await sendWhatsAppMessage(customerId, mensaje);
      return;
    }

    let customer = await prisma.customer.findFirst({ where: { customerId } });
    let stripeCustomerId = customer.stripeCustomerId;

    if (!stripeCustomerId) {
      const stripeCustomer = await stripeClient.customers.create({
        phone: customerId,
        metadata: { whatsappId: customerId },
      });
      stripeCustomerId = stripeCustomer.id;
      await prisma.customer.update({
        where: { customerId: customer.customerId },
        data: { stripeCustomerId }
      });
    }

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: {
              name: `Orden #${
                order.dailyOrderNumber
              } - ${(await getCurrentMexicoTime()).format("DD/MM/YYYY")}`,
            },
            unit_amount: Math.round(order.totalCost * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${env.FRONTEND_BASE_URL}/payment-success`,
      cancel_url: `${env.FRONTEND_BASE_URL}/payment-cancel`,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripeSessionId: session.id,
        paymentStatus: "pending",
      }
    });

    const paymentLink = session.url;
    await sendWhatsAppMessage(
      customerId,
      `💳 Por favor, haz clic en el siguiente enlace para proceder con el pago: 🔗 ${paymentLink} 💰`
    );
    // await sendWhatsAppNotification("Se ha generado un link de pago");
  } catch (error) {
    await ErrorService.handleAndSendError(error, customerId, {
      userId: customerId,
      operation: 'handleOnlinePayment',
      metadata: { messageId }
    });
  }
}

async function sendMenu(phoneNumber: string): Promise<boolean> {
  try {
    const fullMenu = await ProductService.getActiveProducts({ formatForAI: true });
    // La utilidad messageSender se encarga de dividir mensajes largos automáticamente
    const success = await sendWhatsAppMessage(phoneNumber, String(fullMenu));
    return success;
  } catch (error) {
    await ErrorService.handleAndSendError(error, phoneNumber, {
      userId: phoneNumber,
      operation: 'sendMenu'
    });
    return false;
  }
}

async function handleWaitTimes(customerId: string): Promise<void> {
  try {
    const config = await prisma.restaurantConfig.findFirst();
    const message = WAIT_TIMES_MESSAGE(
      config.estimatedPickupTime,
      config.estimatedDeliveryTime
    );
    await sendWhatsAppMessage(customerId, message);
  } catch (error) {
    await ErrorService.handleAndSendError(error, customerId, {
      userId: customerId,
      operation: 'handleWaitTimes'
    });
  }
}

async function handleRestaurantInfo(customerId: string): Promise<void> {
  try {
    const message = await RESTAURANT_INFO_MESSAGE();
    await sendWhatsAppMessage(customerId, message);
  } catch (error) {
    await ErrorService.handleAndSendError(error, customerId, {
      userId: customerId,
      operation: 'handleRestaurantInfo'
    });
  }
}

async function handleChatbotHelp(customerId: string): Promise<void> {
  try {
    const message = await CHATBOT_HELP_MESSAGE();
    await sendWhatsAppMessage(customerId, message);
  } catch (error) {
    await ErrorService.handleAndSendError(error, customerId, {
      userId: customerId,
      operation: 'handleChatbotHelp'
    });
  }
}

async function handleChangeDeliveryInfo(from: string): Promise<void> {
  const otp = OTPService.generateOTP();
  OTPService.storeOTP(from, otp);
  const updateLink = `${env.FRONTEND_BASE_URL}/delivery-info-registration/${from}?otp=${otp}`;
  const message = CHANGE_DELIVERY_INFO_MESSAGE(updateLink);
  await sendWhatsAppMessage(from, message);
}
