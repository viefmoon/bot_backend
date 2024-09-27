import axios from "axios";
import {
  OrderItem,
  Product,
  ProductVariant,
  SelectedModifier,
  Modifier,
  SelectedPizzaIngredient,
  PizzaIngredient,
  PreOrder,
  Order,
  Customer,
} from "../models";

import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "../utils/whatsAppUtils";

import dotenv from "dotenv";
dotenv.config();

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

async function createOrderFromPreOrder(preOrder, clientId) {
  try {
    const { orderItems, orderType, deliveryInfo, scheduledDeliveryTime } =
      preOrder;

    const orderData = {
      action: "create",
      orderType,
      orderItems,
      deliveryInfo,
      scheduledDeliveryTime,
      clientId,
    };

    // Agregar registro de depuración
    console.log(
      "Datos de la orden a enviar:",
      JSON.stringify(orderData, null, 2)
    );

    const response = await axios.post(
      `${process.env.BASE_URL}/api/create_order`,
      orderData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Agregar registro de depuración
    console.log("Respuesta del servidor:", response.data);

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
    console.error(
      "Error detallado en createOrderFromPreOrder:",
      error.response?.data || error.message
    );
    throw error;
  }
}

export async function handleOrderConfirmation(clientId, messageId) {
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

    const interactiveOptions = {
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
                title: "Pagar en línea",
              },
            ],
          },
        ],
      },
    };

    const confirmationMessageId = await sendWhatsAppInteractiveMessage(
      clientId,
      interactiveOptions
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

export async function handleOrderDiscard(clientId, messageId) {
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

export async function handleOrderCancellation(clientId, messageId) {
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

export async function handleOrderModification(clientId, messageId) {
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
