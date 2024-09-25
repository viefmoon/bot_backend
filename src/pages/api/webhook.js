import { verificarHorarioAtencion } from "../../utils/timeUtils";
import { handleChatRequest } from "./chat";
import {
  Customer,
  PreOrder,
  Order,
  OrderItem,
  Product,
  ProductVariant,
  SelectedModifier,
  Modifier,
  SelectedPizzaIngredient,
  PizzaIngredient,
  RestaurantConfig,
  BannedCustomer,
  MessageRateLimit,
  MessageLog,
} from "../../models";
import axios from "axios";
import stripe from "stripe";
import fs from "fs";
import FormData from "form-data";

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// Manejador principal del webhook
export default async function handler(req, res) {
  if (req.method === "GET") {
    handleWebhookVerification(req, res);
  } else if (req.method === "POST") {
    if (req.headers["stripe-signature"]) {
      await handleStripeWebhook(req, res);
    } else {
      await handleWhatsAppWebhook(req, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}

// Verificación del webhook de WhatsApp
function handleWebhookVerification(req, res) {
  const { mode, token, challenge } =
    req.query[("hub.mode", "hub.verify_token", "hub.challenge")];
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("Webhook verificado exitosamente");
    res.status(200).send(challenge);
  } else {
    console.error("Fallo en la verificación del webhook");
    res.status(403).end();
  }
}

async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripeClient.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Error de firma de webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const order = await Order.findOne({
      where: { stripeSessionId: session.id },
    });
    if (order) {
      await order.update({ paymentStatus: "paid" });
      const customer = await Customer.findOne({
        where: { stripeCustomerId: session.customer },
      });
      if (customer) {
        await sendWhatsAppMessage(
          customer.clientId,
          `¡Tu pago para la orden #${order.dailyOrderNumber} ha sido confirmado! Gracias por tu compra.`
        );
      }
    }
  }

  res.json({ received: true });
}

// Manejo de mensajes de WhatsApp
async function handleWhatsAppWebhook(req, res) {
  res.status(200).send("EVENT_RECEIVED");
  const { object, entry } = req.body;

  if (object === "whatsapp_business_account") {
    for (const entryItem of entry) {
      for (const change of entryItem.changes) {
        const { value } = change;
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await processMessage(message);
          }
        }
      }
    }
  } else {
    res.sendStatus(404);
  }
}

// Procesar mensaje individual
async function processMessage(message) {
  const { from, type, id } = message;

  if (await checkBannedCustomer(from)) {
    await sendBannedMessage(from);
    return;
  }

  if (await MessageLog.findOne({ where: { messageId: id } })) {
    return;
  }

  await MessageLog.create({ messageId: id, processed: true });

  if (!(await verificarHorarioAtencion())) {
    await sendWhatsAppMessage(
      from,
      "Lo sentimos, el restaurante está cerrado en este momento."
    );
    return;
  }

  switch (type) {
    case "text":
      await handleTextMessage(from, message.text.body);
      break;
    case "interactive":
      await handleInteractiveMessage(from, message);
      break;
    case "audio":
      await handleAudioMessage(from, message);
      break;
    default:
      console.log(`Tipo de mensaje no manejado: ${type}`);
  }
}

// Manejar mensaje de texto
async function handleTextMessage(from, text) {
  if (await checkMessageRateLimit(from)) {
    await sendWhatsAppMessage(
      from,
      "Has enviado demasiados mensajes. Por favor, espera un momento."
    );
    return;
  }

  const [customer, created] = await Customer.findOrCreate({
    where: { clientId: from },
    defaults: {
      fullChatHistory: "[]",
      relevantChatHistory: "[]",
      lastInteraction: new Date(),
    },
  });

  let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
  let relevantChatHistory = JSON.parse(customer.relevantChatHistory || "[]");

  if (new Date() - new Date(customer.lastInteraction) > 60 * 60 * 1000) {
    relevantChatHistory = [];
  }

  if (text.toLowerCase().includes("olvida lo anterior")) {
    await resetChatHistory(customer);
    return;
  }

  if (relevantChatHistory.length === 0) {
    await sendWelcomeMessage(from);
  }

  const userMessage = { role: "user", content: text };
  fullChatHistory.push(userMessage);
  relevantChatHistory.push(userMessage);

  const response = await handleChatRequest({
    relevantMessages: relevantChatHistory,
    conversationId: from,
  });
  await processAndSendResponse(
    from,
    response,
    fullChatHistory,
    relevantChatHistory
  );

  await customer.update({
    fullChatHistory: JSON.stringify(fullChatHistory),
    relevantChatHistory: JSON.stringify(relevantChatHistory),
    lastInteraction: new Date(),
  });
}

async function handleInteractiveMessage(from, message) {
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

// Manejar mensaje de audio
async function handleAudioMessage(from, message) {
  if (message.audio && message.audio.id) {
    try {
      const audioUrl = await getAudioUrl(message.audio.id);
      if (audioUrl) {
        const transcribedText = await transcribeAudio(audioUrl);
        await handleTextMessage(from, transcribedText);
      } else {
        throw new Error("No se pudo obtener la URL del audio.");
      }
    } catch (error) {
      console.error("Error al procesar el mensaje de audio:", error);
      await sendWhatsAppMessage(
        from,
        "Hubo un problema al procesar tu mensaje de audio. Por favor, intenta nuevamente."
      );
    }
  } else {
    console.error("No se encontró el ID del audio.");
    await sendWhatsAppMessage(
      from,
      "No pude obtener la información necesaria del mensaje de audio."
    );
  }
}

// Funciones auxiliares
async function checkBannedCustomer(clientId) {
  return !!(await BannedCustomer.findOne({ where: { clientId } }));
}

async function sendBannedMessage(clientId) {
  await sendWhatsAppMessage(
    clientId,
    "Lo sentimos, tu número ha sido baneado. Contacta con el restaurante si crees que es un error."
  );
}

async function checkMessageRateLimit(clientId) {
  const MAX_MESSAGES = 30;
  const TIME_WINDOW = 5 * 60 * 1000;

  let rateLimit = await MessageRateLimit.findOne({ where: { clientId } });

  if (!rateLimit) {
    await MessageRateLimit.create({
      clientId,
      messageCount: 1,
      lastMessageTime: new Date(),
    });
    return false;
  }

  const now = new Date();
  const timeSinceLastMessage = now - rateLimit.lastMessageTime;

  if (timeSinceLastMessage > TIME_WINDOW) {
    await rateLimit.update({ messageCount: 1, lastMessageTime: now });
    return false;
  }

  if (rateLimit.messageCount >= MAX_MESSAGES) {
    return true;
  }

  await rateLimit.update({
    messageCount: rateLimit.messageCount + 1,
    lastMessageTime: now,
  });
  return false;
}

async function resetChatHistory(customer) {
  await customer.update({ relevantChatHistory: "[]" });
  await sendWhatsAppMessage(
    customer.clientId,
    "Entendido, he olvidado el contexto anterior. ¿En qué puedo ayudarte ahora?"
  );
}

async function sendWelcomeMessage(phoneNumber) {
  const listOptions = {
    body: { text: "¡Bienvenido a La Leña! ¿Cómo podemos ayudarte hoy?" },
    footer: { text: "Selecciona una opción:" },
    action: {
      button: "Ver opciones",
      sections: [
        {
          title: "Acciones",
          rows: [
            { id: "view_menu", title: "Ver Menú" },
            { id: "wait_times", title: "Tiempos de espera" },
            { id: "restaurant_info", title: "Información y horarios" },
          ],
        },
      ],
    },
  };

  await sendWhatsAppInteractiveMessage(phoneNumber, listOptions);
}

async function getAudioUrl(audioId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${audioId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
      }
    );
    return response.data.url;
  } catch (error) {
    console.error("Error al obtener la URL del audio:", error);
    return null;
  }
}

async function transcribeAudio(audioUrl) {
  try {
    const response = await axios.get(audioUrl, {
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
    });
    const audioPath = `/tmp/audio.ogg`;
    const writer = fs.createWriteStream(audioPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const formData = new FormData();
    formData.append("file", fs.createReadStream(audioPath));
    formData.append("model", "whisper-1");

    const whisperResponse = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    fs.unlinkSync(audioPath);

    return whisperResponse.data.text;
  } catch (error) {
    console.error("Error al transcribir el audio:", error);

    if (error.response) {
      console.error("Error en la respuesta de la API:", error.response.data);
    } else if (error.request) {
      console.error("No se recibió respuesta de la API:", error.request);
    } else {
      console.error("Error al configurar la solicitud:", error.message);
    }

    return "Lo siento, no pude transcribir el mensaje de audio.";
  }
}

async function sendWhatsAppInteractiveMessage(phoneNumber, listOptions) {
  try {
    let payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "list",
        ...listOptions,
      },
    };

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Mensaje interactivo con imagen enviado exitosamente");
    return true;
  } catch (error) {
    console.error(
      "Error al enviar mensaje interactivo de WhatsApp:",
      error.response?.data || error.message
    );
    return false;
  }
}

async function sendWhatsAppMessage(phoneNumber, message, listOptions = null) {
  try {
    let payload = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: listOptions ? "interactive" : "text",
      text: listOptions ? undefined : { body: message },
      interactive: listOptions
        ? {
            type: "list",
            ...listOptions,
          }
        : undefined,
    };

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const messageId = response.data.messages[0].id;
    return messageId;
  } catch (error) {
    console.error("Error al enviar mensaje de WhatsApp:", error);
    return null;
  }
}

async function sendMenu(phoneNumber) {
  try {
    const menuText = require("../../data/menu");

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

async function handleOrderModification(clientId, messageId) {
  try {
    const order = await Order.findOne({ where: { messageId } });

    if (!order) {
      console.error(`No se encontró orden para el messageId: ${messageId}`);
      await sendWhatsAppMessage(
        clientId,
        "Lo siento, no se pudo encontrar tu orden para modificar. Por favor, contacta con el restaurante si necesitas ayuda."
      );
      return;
    }

    if (order.status !== "created") {
      await sendWhatsAppMessage(
        clientId,
        "Lo sentimos, pero esta orden ya no se puede modificar porque ya fue aceptada por el restaurante."
      );
      return;
    }

    const orderSummary = await generateOrderSummary(order);

    await sendWhatsAppMessage(
      clientId,
      `Aquí está tu orden actual para modificar:\n\n${orderSummary.withPrices}\n\nPor favor, indica qué cambios deseas realizar.`
    );
  } catch (error) {
    console.error("Error al modificar la orden:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al recuperar tu orden para modificar. Por favor, intenta nuevamente o contacta con el restaurante."
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

async function generateOrderSummary(order) {
  try {
    const tipoOrdenTraducido =
      order.orderType === "delivery"
        ? "Entrega a domicilio"
        : "Recolección en restaurante";
    let orderSummaryWithPrices = `📦 *Orden recuperada para modificar*\n\n`;
    let orderSummaryWithoutPrices = `📦 *Orden recuperada para modificar*\n\n`;
    orderSummaryWithPrices += `🛍️ *Orden #${order.dailyOrderNumber}*\n\n`;
    orderSummaryWithoutPrices += `🛍️ *Orden #${order.dailyOrderNumber}*\n\n`;
    orderSummaryWithPrices += `🍽️ *Tipo:* ${tipoOrdenTraducido}\n`;
    orderSummaryWithoutPrices += `🍽️ *Tipo:* ${tipoOrdenTraducido}\n`;
    if (order.deliveryInfo) {
      orderSummaryWithPrices += `🏠 *Información de entrega:* ${order.deliveryInfo}\n`;
      orderSummaryWithoutPrices += `🏠 *Información de entrega:* ${order.deliveryInfo}\n`;
    }
    orderSummaryWithPrices += `💰 *Precio total:* $${order.totalCost}\n`;
    orderSummaryWithoutPrices += `💰 *Precio total:* $${order.totalCost}\n`;
    orderSummaryWithPrices += `📅 *Fecha de creación:* ${order.createdAt.toLocaleString()}\n`;
    orderSummaryWithoutPrices += `📅 *Fecha de creación:* ${order.createdAt.toLocaleString()}\n`;
    orderSummaryWithPrices += `⏱️ *Tiempo estimado de entrega:* ${order.estimatedTime}\n\n`;
    orderSummaryWithoutPrices += `⏱️ *Tiempo estimado de entrega:* ${order.estimatedTime}\n\n`;
    orderSummaryWithPrices += `🛒 *Productos:*\n`;
    orderSummaryWithoutPrices += `🛒 *Productos:*\n`;

    if (typeof OrderItem?.findAll !== "function") {
      throw new Error("OrderItem.findAll no es una función");
    }

    const orderItems = await OrderItem.findAll({
      where: { orderId: order.id },
      include: [
        { model: Product, as: "Product" },
        { model: ProductVariant, as: "ProductVariant" },
      ],
    });

    for (const item of orderItems) {
      const productName =
        item.ProductVariant?.name ||
        item.Product?.name ||
        "Producto desconocido";
      orderSummaryWithPrices += `   *${productName}* x${item.quantity} - $${item.price}\n`;
      orderSummaryWithoutPrices += `   *${productName}* x${item.quantity}\n`;

      if (typeof SelectedModifier?.findAll === "function") {
        const selectedModifiers = await SelectedModifier.findAll({
          where: { orderItemId: item.id },
          include: [{ model: Modifier, as: "Modifier" }],
        });

        if (selectedModifiers.length > 0) {
          orderSummaryWithPrices += `     *Modificadores:*\n`;
          orderSummaryWithoutPrices += `     *Modificadores:*\n`;
          selectedModifiers.forEach((mod) => {
            if (mod.Modifier) {
              orderSummaryWithPrices += `      • ${mod.Modifier.name} - $${mod.Modifier.price}\n`;
              orderSummaryWithoutPrices += `      • ${mod.Modifier.name}\n`;
            }
          });
        }
      }

      if (typeof SelectedPizzaIngredient?.findAll === "function") {
        const selectedPizzaIngredients = await SelectedPizzaIngredient.findAll({
          where: { orderItemId: item.id },
          include: [{ model: PizzaIngredient, as: "PizzaIngredient" }],
        });

        if (selectedPizzaIngredients.length > 0) {
          orderSummaryWithPrices += `    *Ingredientes de pizza:*\n`;
          orderSummaryWithoutPrices += `    *Ingredientes de pizza:*\n`;
          const ingredientesPorMitad = { left: [], right: [], full: [] };

          selectedPizzaIngredients.forEach((ing) => {
            if (ing.PizzaIngredient) {
              ingredientesPorMitad[ing.half].push(ing.PizzaIngredient.name);
            }
          });

          if (ingredientesPorMitad.full.length > 0) {
            orderSummaryWithPrices += `      • ${ingredientesPorMitad.full.join(
              ", "
            )}\n`;
            orderSummaryWithoutPrices += `      • ${ingredientesPorMitad.full.join(
              ", "
            )}\n`;
          }

          if (
            ingredientesPorMitad.left.length > 0 ||
            ingredientesPorMitad.right.length > 0
          ) {
            const mitadIzquierda = ingredientesPorMitad.left.join(", ");
            const mitadDerecha = ingredientesPorMitad.right.join(", ");
            orderSummaryWithPrices += `      • ${mitadIzquierda} / ${mitadDerecha}\n`;
            orderSummaryWithoutPrices += `      • ${mitadIzquierda} / ${mitadDerecha}\n`;
          }
        }
      }

      if (item.comments) {
        orderSummaryWithPrices += `    💬 *Comentarios:* ${item.comments}\n`;
        orderSummaryWithoutPrices += `    💬 *Comentarios:* ${item.comments}\n`;
      }
      orderSummaryWithPrices += `\n`;
      orderSummaryWithoutPrices += `\n`;
    }

    fullChatHistory.push({
      role: "assistant",
      content: orderSummaryWithPrices,
    });

    relevantChatHistory.push({
      role: "assistant",
      content: orderSummaryWithoutPrices,
    });

    return orderSummaryWithPrices;
  } catch (error) {
    console.error("Error al generar el resumen de la orden:", error);
    return {
      withPrices:
        "No se pudo generar el resumen de la orden debido a un error.",
      withoutPrices:
        "No se pudo generar el resumen de la orden debido a un error.",
    };
  }
}

async function handleOrderCancellation(clientId, messageId) {
  try {
    const order = await Order.findOne({ where: { messageId } });

    if (!order) {
      console.error(`No se encontró orden para el messageId: ${messageId}`);
      await sendWhatsAppMessage(
        clientId,
        "Lo siento, no se pudo encontrar tu orden para cancelar. Por favor, contacta con el restaurante si necesitas ayuda."
      );
      return;
    }

    if (order.status !== "created") {
      await sendWhatsAppMessage(
        clientId,
        "Lo sentimos, pero esta orden ya no se puede cancelar porque ya fue aceptada por el restaurante."
      );
      return;
    }

    await order.update({ status: "canceled" });

    await sendWhatsAppMessage(
      clientId,
      `Tu orden #${order.dailyOrderNumber} ha sido cancelada exitosamente. Si tienes alguna pregunta, por favor contacta con el restaurante.`
    );
  } catch (error) {
    console.error("Error al cancelar la orden:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al cancelar tu orden. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}

async function handleOrderConfirmation(clientId, messageId) {
  try {
    const preOrder = await PreOrder.findOne({ where: { messageId } });

    if (!preOrder) {
      console.error(`No se encontró preorden para el messageId: ${messageId}`);
      await sendWhatsAppMessage(
        clientId,
        "Lo siento, no se pudo encontrar tu orden. Por favor, intenta nuevamente."
      );
      return;
    }

    const { newOrder, orderSummary } = await createOrderFromPreOrder(
      preOrder,
      clientId
    );

    const confirmationMessageId = await sendWhatsAppMessage(
      clientId,
      orderSummary,
      {
        type: "list",
        header: {
          type: "text",
          text: "Resumen del Pedido",
        },
        body: {
          text: orderSummary,
        },
        footer: {
          text: "Selecciona una opción:",
        },
        action: {
          button: "Ver opciones",
          sections: [
            {
              title: "Acciones",
              rows: [
                {
                  id: "cancel_order",
                  title: "Cancelar Pedido",
                },
                {
                  id: "modify_order",
                  title: "Modificar Pedido",
                },
                {
                  id: "pay_online",
                  title: "Pagar en linea",
                },
              ],
            },
          ],
        },
      }
    );

    if (confirmationMessageId) {
      await Order.update(
        { messageId: confirmationMessageId },
        { where: { id: newOrder.id } }
      );
    }

    await preOrder.destroy();
  } catch (error) {
    console.error("Error al confirmar la orden:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al procesar tu orden. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}

async function handleOrderDiscard(clientId, messageId) {
  try {
    const customer = await Customer.findOne({ where: { clientId } });

    if (!customer) {
      console.error(`No se encontró cliente para el ID: ${clientId}`);
      await sendWhatsAppMessage(
        clientId,
        "Lo siento, hubo un problema al procesar tu solicitud. Por favor, intenta nuevamente."
      );
      return;
    }

    await customer.update({ relevantChatHistory: "[]" });

    const confirmationMessage =
      "Tu orden ha sido descartada y el historial de conversación reciente ha sido borrado. ¿En qué más puedo ayudarte?";
    await sendWhatsAppMessage(clientId, confirmationMessage);

    let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
    fullChatHistory.push(
      { role: "user", content: "Descartar orden" },
      { role: "assistant", content: confirmationMessage }
    );
    await customer.update({ fullChatHistory: JSON.stringify(fullChatHistory) });

    console.log(
      `Orden descartada y historial relevante borrado para el cliente: ${clientId}`
    );
  } catch (error) {
    console.error("Error al descartar la orden:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al procesar tu solicitud. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}

async function createOrderFromPreOrder(preOrder, clientId) {
  try {
    const { orderItems, orderType, deliveryInfo } = preOrder;

    const orderData = {
      action: "create",
      orderType,
      orderItems,
      deliveryInfo,
      clientId,
    };

    const response = await axios.post(
      `${process.env.BASE_URL}/api/create_order`,
      orderData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 201) {
      const newOrder = response.data.orden;

      const tipoOrdenTraducido =
        orderType === "delivery"
          ? "Entrega a domicilio"
          : "Recolección en restaurante";

      let orderSummary = `🎉 *¡Tu orden #${newOrder.id} ha sido creada exitosamente!* 🎉\n\n`;
      orderSummary += `📞 *Telefono:* ${newOrder.telefono}\n`;
      orderSummary += `🍽️ *Tipo:* ${tipoOrdenTraducido}\n`;
      orderSummary += `🏠 *informacion de entrega:* ${newOrder.informacion_entrega}\n`;
      orderSummary += `💰 *Precio total:* $${newOrder.precio_total}\n`;
      orderSummary += `📅 *Fecha de creación:* ${newOrder.fecha_creacion}\n`;
      orderSummary += `⏱️ *Tiempo estimado de entrega:* ${newOrder.tiempoEstimado}\n\n`;
      orderSummary += `🛒 *Productos:*\n`;
      newOrder.productos.forEach((producto) => {
        orderSummary += `   *${producto.nombre}* x${producto.cantidad} - $${producto.precio}\n`;
        if (producto.modificadores.length > 0) {
          orderSummary += `     *Modificadores:*\n`;
          producto.modificadores.forEach((mod) => {
            orderSummary += `      • ${mod.nombre} - $${mod.precio}\n`;
          });
        }
        if (
          producto.ingredientes_pizza &&
          producto.ingredientes_pizza.length > 0
        ) {
          orderSummary += `    *Ingredientes de pizza:*\n`;

          const ingredientesPorMitad = {
            left: [],
            right: [],
            full: [],
          };

          producto.ingredientes_pizza.forEach((ing) => {
            ingredientesPorMitad[ing.mitad].push(ing.nombre);
          });

          if (ingredientesPorMitad.full.length > 0) {
            orderSummary += `      • ${ingredientesPorMitad.full.join(", ")}\n`;
          }

          if (
            ingredientesPorMitad.left.length > 0 ||
            ingredientesPorMitad.right.length > 0
          ) {
            const mitadIzquierda = ingredientesPorMitad.left.join(", ");
            const mitadDerecha = ingredientesPorMitad.right.join(", ");
            orderSummary += `      • ${mitadIzquierda} / ${mitadDerecha}\n`;
          }
        }
        if (producto.comments) {
          orderSummary += `    💬 *Comentarios:* ${producto.comments}\n`;
        }
        orderSummary += `\n`;
      });
      orderSummary += `\n¡Gracias por tu pedido! 😊🍽️`;
      orderSummary += `\nEn unos momentos recibirás la confirmación de recepción por parte del restaurante.`;

      return { newOrder, orderSummary };
    } else {
      throw new Error("Error al crear la orden");
    }
  } catch (error) {
    console.error("Error en createOrderFromPreOrder:", error);
    throw error;
  }
}
