import MessageLog from "../../models/messageLog";
import { verificarHorarioAtencion } from "../../utils/timeUtils";
const { handleChatRequest } = require("./chat");
const Customer = require("../../models/customer");
const PreOrder = require("../../models/preOrder");
const Order = require("../../models/order");
const axios = require("axios");
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
    res.status(200).send("EVENT_RECEIVED");
    const { object, entry } = req.body;

    if (object === "whatsapp_business_account") {
      for (const entryItem of entry) {
        const { changes } = entryItem;
        for (const change of changes) {
          const { value } = change;

          // Verificar si hay mensajes recibidos
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const { from, type, id } = message;

              // Verificar si el mensaje ya ha sido procesado
              const existingMessage = await MessageLog.findOne({
                where: { messageId: id },
              });
              if (existingMessage) {
                continue; // Saltar al siguiente mensaje
              }

              // Registrar el nuevo mensaje
              await MessageLog.create({ messageId: id, processed: true });

              // Verificar horario de atención solo para mensajes recibidos
              const estaAbierto = await verificarHorarioAtencion();
              if (!estaAbierto) {
                await sendWhatsAppMessage(
                  from,
                  "Lo sentimos, solo podremos procesar tu pedido cuando el restaurante esté abierto. Horarios: Martes a sábado: 6:00 PM - 11:00 PM, Domingos: 2:00 PM - 11:00 PM."
                );
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
    const { orderItems, orderType, deliveryAddress, customerName } = preOrder;

    // Preparar los datos para la creación de la orden
    const orderData = {
      action: "create",
      orderType,
      orderItems,
      deliveryAddress,
      customerName,
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
    const deliveryAddress = customerData.deliveryAddress || "Desconocido";
    const pickupName = customerData.pickupName || "Desconocido";

    // Crear el mensaje con la información del cliente
    const customerInfoMessage = `Dirección de entrega: ${deliveryAddress} - Nombre para recoleccion: ${pickupName}`;

    // Añadir la información del cliente al inicio si no está presente
    if (
      !relevantChatHistory.some((msg) =>
        msg.content.startsWith("Dirección de entrega:")
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
      messages: relevantChatHistory,
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
        deliveryAddress: customer.deliveryAddress,
        pickupName: customer.pickupName,
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
      "El menú ha sido enviado, si tienes alguna duda, no dudes en preguntar";
    await sendWhatsAppMessage(phoneNumber, confirmationMessage);

    // Actualizar el historial de chat
    let customer = await Customer.findOne({ where: { clientId: phoneNumber } });
    if (customer) {
      let fullChatHistory = JSON.parse(customer.fullChatHistory || "[]");
      let relevantChatHistory = JSON.parse(
        customer.relevantChatHistory || "[]"
      );

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
