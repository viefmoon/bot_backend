import MessageLog from "../../models/messageLog";
import { verificarHorarioAtencion } from "../../utils/timeUtils";
const { handleChatRequest } = require("./chat");
const Customer = require("../../models/customer");
const PreOrder = require("../../models/preOrder");
const Order = require("../../models/order");
const OrderItem = require("../../models/orderItem");
const Product = require("../../models/product");
const ProductVariant = require("../../models/productVariant");
const SelectedModifier = require("../../models/selectedModifier");
const Modifier = require("../../models/modifier");
const SelectedPizzaIngredient = require("../../models/selectedPizzaIngredient");
const PizzaIngredient = require("../../models/pizzaIngredient");
const axios = require("axios");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === "GET") {
    // Verificación del webhook
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verificado exitosamente");
      res.status(200).send(challenge);
    } else {
      console.error("Fallo en la verificación del webhook");
      res.status(403).end();
    }
  } else if (req.method === "POST") {
    // Manejar webhooks de Stripe y WhatsApp
    if (req.headers["stripe-signature"]) {
      return handleStripeWebhook(req, res);
    }
    res.status(200).send("EVENT_RECEIVED");
    const { object, entry } = req.body;

    if (object === "whatsapp_business_account") {
      for (const entryItem of entry) {
        const { changes } = entryItem;
        for (const change of changes) {
          const { value } = change;

          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const { from, type, id } = message;

              // Verificar si el mensaje ya ha sido procesado
              const existingMessage = await MessageLog.findOne({
                where: { messageId: id },
              });
              if (existingMessage) {
                continue;
              }

              // Registrar el nuevo mensaje
              await MessageLog.create({ messageId: id, processed: true });

              // Verificar horario de atención
              const estaAbierto = await verificarHorarioAtencion();
              if (!estaAbierto) {
                await sendWhatsAppMessage(
                  from,
                  "Lo sentimos, solo podremos procesar tu pedido cuando el restaurante esté abierto. Horarios: Martes a sábado: 6:00 PM - 11:00 PM, Domingos: 2:00 PM - 11:00 PM."
                );
                continue;
              }

              // Procesar el mensaje según su tipo
              if (type === "text") {
                await handleMessage(from, message.text.body);
              } else if (type === "interactive") {
                await handleInteractiveMessage(from, message);
              } else {
                console.log(`Tipo de mensaje no manejado: ${type}`);
              }
            }
          }
        }
      }
      res.status(200).send("EVENT_RECEIVED");
    } else {
      res.sendStatus(404);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Método ${req.method} no permitido`);
  }
}

async function handleInteractiveMessage(from, message) {
  if (message.interactive.type === "button_reply") {
    const buttonId = message.interactive.button_reply.id;
    if (buttonId === "confirm_order") {
      await handleOrderConfirmation(from, message.context.id);
    } else if (buttonId === "view_menu") {
      await sendMenu(from);
    }
  } else if (message.interactive.type === "list_reply") {
    const listReplyId = message.interactive.list_reply.id;
    if (listReplyId === "cancel_order") {
      await handleOrderCancellation(from, message.context.id);
    } else if (listReplyId === "modify_order") {
      await handleOrderModification(from, message.context.id);
    } else if (listReplyId === "pay_online") {
      await handleOnlinePayment(from, message.context.id);
    }
  }
}

async function handleOrderCancellation(clientId, messageId) {
  try {
    // Buscar la orden por el messageId
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

    // Crear la orden real basada en la preorden y obtener el resumen
    const { newOrder, orderSummary } = await createOrderFromPreOrder(
      preOrder,
      clientId
    );

    // Enviar confirmación al cliente con menú de lista
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

    // Actualizar la orden con el messageId de confirmación
    if (confirmationMessageId) {
      await Order.update(
        { messageId: confirmationMessageId },
        { where: { id: newOrder.id } }
      );
    }

    // Eliminar la preorden
    await preOrder.destroy();
  } catch (error) {
    console.error("Error al confirmar la orden:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al procesar tu orden. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}

async function createOrderFromPreOrder(preOrder, clientId) {
  try {
    const { orderItems, orderType, deliveryInfo } = preOrder;

    // Preparar los datos para la creación de la orden
    const orderData = {
      action: "create",
      orderType,
      orderItems,
      deliveryInfo,
      clientId,
    };

    // Llamar a la función createOrder de create_order.js
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
      orderSummary += `🍽️ *Tipo:* ${tipoOrdenTraducido}\n`;
      if (newOrder.direccion_entrega) {
        orderSummary += `🏠 *Dirección de entrega:* ${newOrder.direccion_entrega}\n`;
      }
      if (newOrder.nombre_recoleccion) {
        orderSummary += `👤 *Nombre para recolección:* ${newOrder.nombre_recoleccion}\n`;
      }
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
            none: [],
          };

          producto.ingredientes_pizza.forEach((ing) => {
            ingredientesPorMitad[ing.mitad].push(ing.nombre);
          });

          if (ingredientesPorMitad.none.length > 0) {
            orderSummary += `      • ${ingredientesPorMitad.none.join(", ")}\n`;
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

async function handleMessage(from, message) {
  try {
    // Buscar o crear el cliente
    let [customer, created] = await Customer.findOrCreate({
      where: { clientId: from },
      defaults: { fullChatHistory: "[]", relevantChatHistory: "[]" },
    });

    // Obtener y parsear los historiales de chat
    let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
    let relevantChatHistory = JSON.parse(customer.relevantChatHistory || "[]");

    console.log("Mensaje recibido:", message);

    // Verificar si el mensaje es para eliminar el historial relevante
    if (message.toLowerCase().includes("olvida lo anterior")) {
      relevantChatHistory = [];
      await customer.update({
        relevantChatHistory: JSON.stringify(relevantChatHistory),
      });
      console.log("Historial relevante eliminado para el cliente:", from);
      return;
    }

    // Obtener datos adicionales del cliente
    const customerData = await getCustomerData(from);
    const deliveryInfo = customerData.deliveryInfo || "Desconocido";

    // Crear el mensaje con la información del cliente
    const customerInfoMessage = `Información de entrega: ${deliveryInfo}`;

    // Añadir la información del cliente al inicio si no está presente
    if (
      !relevantChatHistory.some((msg) =>
        msg.content.startsWith("Información de entrega:")
      )
    ) {
      relevantChatHistory.unshift({
        role: "user",
        content: customerInfoMessage,
      });
    }

    // Enviar mensaje de bienvenida si el historial relevante está vacío
    if (relevantChatHistory.length === 1) {
      // Solo el mensaje con la información del cliente está presente
      await sendWelcomeMessage(from);
    }

    // Añadir el nuevo mensaje del usuario a ambos historiales
    const userMessage = { role: "user", content: message };
    if (message && message.trim() !== "") {
      fullChatHistory.push(userMessage);
      relevantChatHistory.push(userMessage);
    }

    // Llamar directamente a la función del manejador en chat.js
    const response = await handleChatRequest({
      relevantMessages: relevantChatHistory,
      conversationId: from,
    });

    // Procesar y enviar respuestas
    if (Array.isArray(response)) {
      for (const msg of response) {
        if (
          msg.text &&
          msg.text.trim() !== "" &&
          msg.sendToWhatsApp !== false
        ) {
          await sendWhatsAppMessage(from, msg.text);
          const assistantMessage = { role: "assistant", content: msg.text };
          fullChatHistory.push(assistantMessage);
          if (msg.isRelevant !== false) {
            // Si no contiene isRelevant o es true
            relevantChatHistory.push(assistantMessage);
          }
        }
      }
    } else {
      if (
        response.text &&
        response.text.trim() !== "" &&
        response.sendToWhatsApp !== false
      ) {
        await sendWhatsAppMessage(from, response.text);
        const assistantMessage = {
          role: "assistant",
          content: response.text,
        };
        fullChatHistory.push(assistantMessage);
        if (response.isRelevant !== false) {
          // Si no contiene isRelevant o es true
          relevantChatHistory.push(assistantMessage);
        }
      }
    }
    console.log("relevantChatHistory", relevantChatHistory);

    // Actualizar los historiales de chat en la base de datos
    await customer.update({
      fullChatHistory: JSON.stringify(fullChatHistory),
      relevantChatHistory: JSON.stringify(relevantChatHistory),
    });
  } catch (error) {
    console.error("Error al procesar el mensaje:", error);
  }
}

// Función para obtener datos adicionales del cliente
async function getCustomerData(clientId) {
  try {
    const customer = await Customer.findOne({ where: { clientId } });
    if (customer) {
      return {
        deliveryInfo: customer.deliveryInfo,
      };
    }
    return {};
  } catch (error) {
    console.error("Error al obtener datos del cliente:", error);
    return {};
  }
}

async function sendWelcomeMessage(phoneNumber) {
  try {
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "view_menu",
          title: "Ver Menú",
        },
      },
      {
        type: "reply",
        reply: {
          id: "view_delivery_times",
          title: "Consultar Tiempos de Entrega",
        },
      },
    ];

    const message = "¡Bienvenido a La Leña! ¿Cómo podemos ayudarte hoy?";
    const imageUrl = `${process.env.BASE_URL}/images/bienvenida.jpg`;

    await sendWhatsAppImageMessage(phoneNumber, imageUrl, message, buttons);
    return true;
  } catch (error) {
    console.error("Error al enviar mensaje de bienvenida con imagen:", error);
    return false;
  }
}

async function sendWhatsAppImageMessage(
  phoneNumber,
  imageUrl,
  caption,
  buttons
) {
  try {
    let payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        header: {
          type: "image",
          image: {
            link: imageUrl,
          },
        },
        body: {
          text: caption,
        },
        action: {
          buttons: buttons,
        },
      },
    };

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Mensaje con imagen enviado exitosamente");
    return true;
  } catch (error) {
    console.error("Error al enviar mensaje de WhatsApp con imagen:", error);
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
      `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
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
    const menuText = require("../../data/menu"); // Asegúrate de que la ruta sea correcta

    // Enviar el menú como no relevante
    await sendWhatsAppMessage(phoneNumber, menuText);

    // Enviar mensaje de confirmación como relevante
    const confirmationMessage =
      "El menú ha sido enviado, si tienes alguna duda, no dudes en preguntarme";
    await sendWhatsAppMessage(phoneNumber, confirmationMessage);

    // Actualizar el historial de chat
    let customer = await Customer.findOne({ where: { clientId: phoneNumber } });
    if (customer) {
      let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
      let relevantChatHistory = JSON.parse(
        customer.relevantChatHistory || "[]"
      );

      // Añadir mensaje de usuario indicando que solicitó ver el menú
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

async function handleOrderModification(clientId, messageId) {
  try {
    // Buscar la orden por el messageId
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

    // Generar el resumen de la orden
    const orderSummary = await generateOrderSummary(order);

    // Enviar el resumen al cliente
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

    // Verificar si OrderItem está definido y es una función
    if (typeof OrderItem?.findAll !== "function") {
      throw new Error("OrderItem.findAll no es una función");
    }

    // Obtener los items de la orden
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

      // Verificar si SelectedModifier está definido y es una función
      if (typeof SelectedModifier?.findAll === "function") {
        // Obtener modificadores
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

      // Verificar si SelectedPizzaIngredient está definido y es una función
      if (typeof SelectedPizzaIngredient?.findAll === "function") {
        // Obtener ingredientes de pizza
        const selectedPizzaIngredients = await SelectedPizzaIngredient.findAll({
          where: { orderItemId: item.id },
          include: [{ model: PizzaIngredient, as: "PizzaIngredient" }],
        });

        if (selectedPizzaIngredients.length > 0) {
          orderSummaryWithPrices += `    *Ingredientes de pizza:*\n`;
          orderSummaryWithoutPrices += `    *Ingredientes de pizza:*\n`;
          const ingredientesPorMitad = { left: [], right: [], none: [] };

          selectedPizzaIngredients.forEach((ing) => {
            if (ing.PizzaIngredient) {
              ingredientesPorMitad[ing.half].push(ing.PizzaIngredient.name);
            }
          });

          if (ingredientesPorMitad.none.length > 0) {
            orderSummaryWithPrices += `      • ${ingredientesPorMitad.none.join(
              ", "
            )}\n`;
            orderSummaryWithoutPrices += `      • ${ingredientesPorMitad.none.join(
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

    // Hacer push a fullChatHistory y relevantChatHistory
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
      const stripeCustomer = await stripe.customers.create({
        phone: clientId,
        metadata: { whatsappId: clientId },
      });
      stripeCustomerId = stripeCustomer.id;
      await customer.update({ stripeCustomerId });
    }

    const session = await stripe.checkout.sessions.create({
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
      success_url: `https://example.com/success`, // URL genérica
      cancel_url: `https://example.com/cancel`, // URL genérica
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

async function handleStripeWebhook(req, res) {
  co;
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
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
