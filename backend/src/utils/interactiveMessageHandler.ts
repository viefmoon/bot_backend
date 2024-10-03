import * as dotenv from "dotenv";
dotenv.config();
import {
  handlePreOrderConfirmation,
  handlePreOrderDiscard,
  handleOrderCancellation,
  handleOrderModification,
} from "../handlers/orderHandlers";

import { Order, Customer, RestaurantConfig } from "../models";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";
import Stripe from "stripe";
import menuText from "../data/menu";
import { OtpService } from "../services/otp.service";

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
    } else if (listReplyId === "reorder") {
      await handleReorder(from);
    } else if (listReplyId === "chatbot_help") {
      await handleChatbotHelp(from);
    } else if (listReplyId === "change_delivery_info") {
      await handleChangeDeliveryInfo(from);
    }
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
    await sendWhatsAppMessage(phoneNumber, menuText);
    return true;
  } catch (error) {
    return false;
  }
}

async function handleWaitTimes(clientId: string): Promise<void> {
  try {
    const config = await RestaurantConfig.findOne();
    if (!config) {
      throw new Error("No se encontró la configuración del restaurante");
    }

    const message =
      `🕒 *Tiempos de espera estimados:*\n\n` +
      `🏠 Recolección en restaurante: ${config.estimatedPickupTime} minutos\n` +
      `🚚 Entrega a domicilio: ${config.estimatedDeliveryTime} minutos\n\n` +
      `Estos tiempos son aproximados y pueden variar según la demanda actual.`;

    await sendWhatsAppMessage(clientId, message);
  } catch (error) {
    const errorMessage =
      "Hubo un error al obtener los tiempos de espera. Por favor, intenta nuevamente más tarde.";
    await sendWhatsAppMessage(clientId, errorMessage);
  }
}

async function handleRestaurantInfo(clientId: string): Promise<void> {
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

async function handleReorder(clientId: string): Promise<void> {
  await sendWhatsAppMessage(
    clientId,
    "Función no disponible en este momento, pronto estará disponible"
  );
}

async function handleChatbotHelp(clientId: string): Promise<void> {
  const chatbotHelp =
    "🤖💬 *¡Bienvenido al Chatbot de La Leña!*\n\n" +
    "Este asistente virtual está potenciado por inteligencia artificial para brindarte una experiencia fluida y natural. Aquí te explicamos cómo usarlo:\n\n" +
    "🚀 *Iniciar una conversación:*\n" +
    "Envía cualquier mensaje para comenzar. Recibirás opciones para:\n" +
    "   📜 Consultar el menú\n" +
    "   ⏱️ Ver tiempos de espera\n" +
    "   🔄 Reordenar\n" +
    "   ℹ️ Información del restaurante\n\n" +
    "🍕 *Realizar un pedido:*\n" +
    "Escribe o envía un audio con tu pedido. Opciones:\n" +
    "   🏠 Entrega a domicilio: Incluye la dirección completa\n" +
    "   🏃 Recolección en restaurante: Indica el nombre para recoger\n" +
    "Ejemplos:\n" +
    "   '2 pizzas grandes especiales y una coca-cola para entrega a Morelos 66 poniente'\n" +
    "   'Pizza mediana hawaiana y ensalada grande de pollo para recoger, nombre: Juan Pérez'\n\n" +
    "Una vez generado tu pedido, recibirás un mensaje de confirmación cuando el restaurante lo acepte o un mensaje de rechazo en caso de que no puedan procesarlo.\n\n" +
    "✏️ *Modificar un pedido:*\n" +
    "Usa la opción en el mensaje de confirmación, solo si el restaurante aún no lo ha aceptado.\n\n" +
    "❌ *Cancelar un pedido:*\n" +
    "Disponible en las opciones del mensaje de confirmación, solo se puede cancelar si el restaurante aún no ha aceptado el pedido.\n\n" +
    "💳 *Pagar:*\n" +
    "Genera un enlace de pago desde las opciones del mensaje de confirmación.\n\n" +
    "🔁 *Reordenar:*\n" +
    "Selecciona 'Reordenar' en el mensaje de bienvenida para ver tus últimas 3 órdenes y poder reordenar con solo un click.\n\n" +
    "⚠️ *IMPORTANTE:*\n" +
    "Envía un mensaje a la vez y espera la respuesta antes del siguiente para evitar confusiones.\n\n" +
    "¡Disfruta tu experiencia con nuestro chatbot! 🍽️🤖";

  await sendWhatsAppMessage(clientId, chatbotHelp);
}

async function handleChangeDeliveryInfo(from: string): Promise<void> {
  const otp = otpService.generateOTP();
  await otpService.storeOTP(from, otp);
  const updateLink = `${process.env.FRONTEND_BASE_URL}/delivery-info-registration/${from}?otp=${otp}`;

  await sendWhatsAppMessage(
    from,
    `Para actualizar tu información de entrega, por favor utiliza este enlace: ${updateLink}\n\nEste enlace es válido por un tiempo limitado por razones de seguridad.`
  );
}
