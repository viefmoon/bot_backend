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
import getFullMenu from "../data/menu";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const otpService = new OtpService();

export async function handleInteractiveMessage(
  from: string,
  message: any
): Promise<void> {
  if (message.interactive.type === "button_reply") {
    const buttonId = message.interactive.button_reply!.id;
    if (buttonId === "confirm_order") {
      await handlePreOrderConfirmation(from, message.context.id);
    } else if (buttonId === "discard_order") {
      await handlePreOrderDiscard(from, message.context.id);
    } else if (buttonId === "modify_delivery") {
      await handlePreOrderDeliveryModification(from, message.context.id);
    }
  } else if (message.interactive.type === "list_reply") {
    const listReplyId = message.interactive.list_reply!.id;
    if (listReplyId === "cancel_order") {
      await handleOrderCancellation(from, message.context.id);
    } else if (listReplyId === "modify_order") {
      await handleOrderModification(from, message.context.id);
    } else if (listReplyId === "pay_online") {
      await handleOnlinePayment(from, message.context.id);
    } else if (listReplyId === "wait_times") {
      await handleWaitTimes(from);
    } else if (listReplyId === "view_menu") {
      await sendMenu(from);
    } else if (listReplyId === "restaurant_info") {
      await handleRestaurantInfo(from);
    } else if (listReplyId === "chatbot_help") {
      await handleChatbotHelp(from);
    } else if (listReplyId === "change_delivery_info") {
      await handleChangeDeliveryInfo(from);
    }
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
        "No se pudo encontrar la preorden para modificar la información de entrega."
      );
      return;
    }

    const clientId = preOrder.clientId;
    const preOrderId = preOrder.id; // Obtener el ID de la preorden

    const otp = otpService.generateOTP();
    await otpService.storeOTP(clientId, otp);

    const updateLink = `${process.env.FRONTEND_BASE_URL}/delivery-info-registration/${clientId}?otp=${otp}&preOrderId=${preOrderId}`;
    const message = CHANGE_DELIVERY_INFO_MESSAGE(updateLink);

    await sendWhatsAppMessage(clientId, message);
  } catch (error) {
    console.error("Error al manejar la modificación de entrega:", error);
    await sendWhatsAppMessage(
      from,
      "Hubo un error al procesar tu solicitud. Por favor, intenta nuevamente más tarde."
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
        "Lo siento, no se pudo encontrar tu orden para procesar el pago."
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
          "Esta orden ya está en preparación. Por favor, contacta con el restaurante para opciones de pago.";
        break;
      case "prepared":
        mensaje =
          "Esta orden ya está preparada. Por favor, contacta con el restaurante para opciones de pago.";
        break;
      case "in_delivery":
        mensaje =
          "Esta orden ya está en camino. Por favor, paga al repartidor o contacta con el restaurante.";
        break;
      case "canceled":
        mensaje =
          "Esta orden ya ha sido cancelada y no se puede procesar el pago.";
        break;
      case "finished":
        mensaje =
          "Esta orden ya ha sido finalizada y no se puede procesar el pago.";
        break;
      default:
        mensaje =
          "Lo sentimos, pero no se puede procesar el pago en este momento debido al estado actual de la orden.";
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
              name: `Orden #${order.dailyOrderNumber}`,
            },
            unit_amount: Math.round(order.totalCost * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `https://example.com/success`,
      cancel_url: `https://example.com/cancel`,
    });

    await order.update({
      stripeSessionId: session.id,
      paymentStatus: "pending",
    });

    const paymentLink = session.url;
    await sendWhatsAppMessage(
      clientId,
      `Por favor, haz clic en el siguiente enlace para proceder con el pago: ${paymentLink}`
    );
  } catch (error) {
    console.error("Error al procesar el pago en línea:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al procesar tu solicitud de pago. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}

async function sendMenu(phoneNumber: string): Promise<boolean> {
  try {
    const fullMenu = await getFullMenu();
    await sendWhatsAppMessage(phoneNumber, fullMenu);
    return true;
  } catch (error) {
    console.error("Error al enviar el menú:", error);
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
    const errorMessage =
      "Hubo un error al obtener los tiempos de espera. Por favor, intenta nuevamente más tarde.";
    await sendWhatsAppMessage(clientId, errorMessage);
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
