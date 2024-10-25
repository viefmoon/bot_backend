import * as dotenv from "dotenv";
dotenv.config();
import {
  handlePreOrderConfirmation,
  handlePreOrderDiscard,
  handleOrderCancellation,
  handleOrderModification,
} from "../handlers/orderHandlers";

import { Order, Customer, RestaurantConfig, PreOrder } from "../models";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";
import Stripe from "stripe";
import { OtpService } from "../services/otp.service";
import {
  WAIT_TIMES_MESSAGE,
  RESTAURANT_INFO_MESSAGE,
  CHATBOT_HELP_MESSAGE,
  CHANGE_DELIVERY_INFO_MESSAGE,
} from "../config/predefinedMessages";
import { MenuService } from "../services/menu.service";
import logger from "./logger";
import { getCurrentMexicoTime } from "./timeUtils";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const otpService = new OtpService();
const menuService = new MenuService();

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
  const { type, button_reply, list_reply } = message.interactive;
  const messageId = message.context.id;

  if (type === "button_reply") {
    const action =
      BUTTON_ACTIONS[button_reply.id as keyof typeof BUTTON_ACTIONS];
    if (action) await action(from, messageId);
  } else if (type === "list_reply") {
    const action = LIST_ACTIONS[list_reply.id as keyof typeof LIST_ACTIONS];
    if (action) await action(from, messageId);
  }
}

async function handlePreOrderDeliveryModification(
  from: string,
  messageId: string
): Promise<void> {
  try {
    const preOrder = await PreOrder.findOne({ where: { messageId } });

    if (!preOrder) {
      await sendWhatsAppMessage(
        from,
        "❌ No se pudo encontrar la preorden para modificar la información de entrega. 🚫🔍"
      );
      return;
    }

    const clientId = preOrder.clientId;
    const preOrderId = preOrder.id;

    const otp = otpService.generateOTP();
    await otpService.storeOTP(clientId, otp);

    const updateLink = `${process.env.FRONTEND_BASE_URL}/delivery-info-registration/${clientId}?otp=${otp}&preOrderId=${preOrderId}`;
    const message = CHANGE_DELIVERY_INFO_MESSAGE(updateLink);

    await sendWhatsAppMessage(clientId, message);
  } catch (error) {
    logger.error("Error al manejar la modificación de entrega:", error);
    await sendWhatsAppMessage(
      from,
      "❌ Hubo un error al procesar tu solicitud de modificación de entrega. Por favor, intenta nuevamente más tarde. 🚫🔄"
    );
  }
}

async function handleOnlinePayment(
  clientId: string,
  messageId: string
): Promise<void> {
  try {
    const order = await Order.findOne({ where: { messageId } });
    if (!order) {
      await sendWhatsAppMessage(
        clientId,
        "❌ Lo siento, no se pudo encontrar tu orden para procesar el pago. 🚫🔍"
      );
      return;
    }

    if (order.stripeSessionId || order.paymentStatus === "pending") {
      await sendWhatsAppMessage(
        clientId,
        "⚠️ Ya existe un enlace de pago activo para esta orden. Por favor, utiliza el enlace enviado anteriormente o contacta al restaurante si necesitas ayuda. 🔄"
      );
      return;
    }

    // Verificar el estado de la orden
    let mensaje;
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
      await sendWhatsAppMessage(clientId, mensaje);
      return;
    }

    let customer = await Customer.findOne({ where: { clientId } });
    let stripeCustomerId = customer.stripeCustomerId;

    if (!stripeCustomerId) {
      const stripeCustomer = await stripeClient.customers.create({
        phone: clientId,
        metadata: { whatsappId: clientId },
      });
      stripeCustomerId = stripeCustomer.id;
      await customer.update({ stripeCustomerId });
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
              } - ${getCurrentMexicoTime().format("DD/MM/YYYY")}`,
            },
            unit_amount: Math.round(order.totalCost * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_BASE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_BASE_URL}/payment-cancel`,
    });

    await order.update({
      stripeSessionId: session.id,
      paymentStatus: "pending",
    });

    const paymentLink = session.url;
    await sendWhatsAppMessage(
      clientId,
      `💳 Por favor, haz clic en el siguiente enlace para proceder con el pago: 🔗 ${paymentLink} 💰`
    );
  } catch (error) {
    logger.error("Error al procesar el pago en línea:", error);
    await sendWhatsAppMessage(
      clientId,
      "❌ Hubo un error al procesar tu solicitud de pago. 😕 Por favor, intenta nuevamente o contacta con el restaurante. 🔄📞"
    );
  }
}

async function sendMenu(phoneNumber: string): Promise<boolean> {
  try {
    const fullMenu = await menuService.getFullMenu();
    await sendWhatsAppMessage(phoneNumber, fullMenu);
    return true;
  } catch (error) {
    logger.error("Error al enviar el menú:", error);
    await sendWhatsAppMessage(
      phoneNumber,
      "❌ Hubo un error al enviar el menú. Por favor, intenta nuevamente. 🚫🔄"
    );
    return false;
  }
}

async function handleWaitTimes(clientId: string): Promise<void> {
  try {
    const config = await RestaurantConfig.findOne();
    const message = WAIT_TIMES_MESSAGE(
      config.estimatedPickupTime,
      config.estimatedDeliveryTime
    );
    await sendWhatsAppMessage(clientId, message);
  } catch (error) {
    logger.error("Error al obtener los tiempos de espera:", error);
    await sendWhatsAppMessage(
      clientId,
      "❌ Hubo un error al obtener los tiempos de espera. Por favor, intenta nuevamente. 🚫🔄"
    );
  }
}

async function handleRestaurantInfo(clientId: string): Promise<void> {
  await sendWhatsAppMessage(clientId, RESTAURANT_INFO_MESSAGE);
}

async function handleChatbotHelp(clientId: string): Promise<void> {
  await sendWhatsAppMessage(clientId, CHATBOT_HELP_MESSAGE);
}

async function handleChangeDeliveryInfo(from: string): Promise<void> {
  const otp = otpService.generateOTP();
  await otpService.storeOTP(from, otp);
  const updateLink = `${process.env.FRONTEND_BASE_URL}/delivery-info-registration/${from}?otp=${otp}`;
  const message = CHANGE_DELIVERY_INFO_MESSAGE(updateLink);
  await sendWhatsAppMessage(from, message);
}
