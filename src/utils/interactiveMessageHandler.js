dotenv.config();
import {
  handleOrderConfirmation,
  handleOrderDiscard,
  handleOrderCancellation,
  handleOrderModification,
} from "../handlers/orderHandlers";

import { Order, Customer, RestaurantConfig } from "../models";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";
import stripe from "stripe";
import menuText from "../data/menu";

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

export async function handleInteractiveMessage(from, message) {
  if (message.interactive.type === "button_reply") {
    const buttonId = message.interactive.button_reply.id;
    if (buttonId === "confirm_order") {
      await handleOrderConfirmation(from, message.context.id);
    } else if (buttonId === "discard_order") {
      await handleOrderDiscard(from, message.context.id);
    }
  } else if (message.interactive.type === "list_reply") {
    const listReplyId = message.interactive.list_reply.id;
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
    }
  }
}

async function handleOnlinePayment(clientId, messageId) {
  try {
    const order = await Order.findOne({ where: { messageId } });
    if (!order) {
      await sendWhatsAppMessage(
        clientId,
        "Lo siento, no se pudo encontrar tu orden para procesar el pago."
      );
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

async function sendMenu(phoneNumber) {
  try {
    await sendWhatsAppMessage(phoneNumber, menuText);

    const confirmationMessage =
      "El menú ha sido enviado, si tienes alguna duda, no dudes en preguntarme";
    await sendWhatsAppMessage(phoneNumber, confirmationMessage);

    let customer = await Customer.findOne({ where: { clientId: phoneNumber } });
    if (customer) {
      let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
      let relevantChatHistory = JSON.parse(
        customer.relevantChatHistory || "[]"
      );

      const userMessage = { role: "user", content: "view_menu" };
      fullChatHistory.push(userMessage);
      relevantChatHistory.push(userMessage);

      fullChatHistory.push({ role: "assistant", content: menuText });
      fullChatHistory.push({ role: "assistant", content: confirmationMessage });
      relevantChatHistory.push({
        role: "assistant",
        content: confirmationMessage,
      });

      await customer.update({
        fullChatHistory: JSON.stringify(fullChatHistory),
        relevantChatHistory: JSON.stringify(relevantChatHistory),
      });
    }

    console.log("Menú enviado exitosamente");
    return true;
  } catch (error) {
    console.error("Error al enviar el menú:", error);
    return false;
  }
}

async function handleWaitTimes(clientId) {
  try {
    const config = await RestaurantConfig.findOne();

    if (!config) {
      await sendWhatsAppMessage(
        clientId,
        "Lo siento, no se pudo obtener la información de los tiempos de espera en este momento."
      );
      return;
    }

    const message =
      `🕒 *Tiempos de espera estimados:*\n\n` +
      `🏠 Recolección en restaurante: ${config.estimatedPickupTime} minutos\n` +
      `🚚 Entrega a domicilio: ${config.estimatedDeliveryTime} minutos\n\n` +
      `Estos tiempos son aproximados y pueden variar según la demanda actual.`;

    await sendWhatsAppMessage(clientId, message);

    let customer = await Customer.findOne({ where: { clientId } });
    if (customer) {
      let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
      let relevantChatHistory = JSON.parse(
        customer.relevantChatHistory || "[]"
      );

      const userMessage = { role: "user", content: "check_wait_times" };
      const assistantMessage = { role: "assistant", content: message };

      fullChatHistory.push(userMessage, assistantMessage);
      relevantChatHistory.push(userMessage, assistantMessage);

      await customer.update({
        fullChatHistory: JSON.stringify(fullChatHistory),
        relevantChatHistory: JSON.stringify(relevantChatHistory),
      });
    }
  } catch (error) {
    console.error("Error al obtener los tiempos de espera:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al obtener los tiempos de espera. Por favor, intenta nuevamente más tarde."
    );
  }
}

async function handleRestaurantInfo(clientId) {
  const restaurantInfo =
    "🍕 *Información y horarios de La Leña*\n\n" +
    "📍 *Ubicación:* C. Ogazón Sur 36, Centro, 47730 Tototlán, Jal.\n\n" +
    "📞 *Teléfonos:*\n" +
    "   Fijo: 3919160126\n" +
    "   Celular: 3338423316\n\n" +
    "🕒 *Horarios:*\n" +
    "   Martes a sábado: 6:00 PM - 11:00 PM\n" +
    "   Domingos: 2:00 PM - 11:00 PM\n\n" +
    "¡Gracias por tu interés! Esperamos verte pronto.";

  await sendWhatsAppMessage(clientId, restaurantInfo);
}
