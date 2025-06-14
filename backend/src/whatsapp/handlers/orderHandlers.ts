import {
  PreOrder,
  Order,
  Customer,
  OrderItem,
  Product,
  ProductVariant,
  SelectedPizzaIngredient,
  PizzaIngredient,
  SelectedModifier,
  Modifier,
  OrderDeliveryInfo,
  CustomerDeliveryInfo,
} from "../../database/entities";
import logger from "../../common/utils/logger";
import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "../utils/whatsapp.utils";
import { OrderService } from "../../orders/order.service";
import { PreOrderService } from "../../orders/pre-order.service";

import * as dotenv from "dotenv";
import { CreateOrderDto } from "../../orders/dto/create-order.dto";
import { OrderSummaryResult, NewOrder } from "../../common/types/order.types";
dotenv.config();

// Función auxiliar para generar el resumen de productos
function generateProductSummary(producto: any): string {
  let summary = `- *${producto.cantidad}x ${producto.nombre}*: $${producto.precio}\n`;

  if (producto.ingredientes_pizza?.length > 0) {
    summary += generatePizzaIngredientsSummary(producto.ingredientes_pizza);
  }

  if (producto.modificadores.length > 0) {
    summary += `  🔸 Modificadores: ${producto.modificadores
      .map((mod) => mod.nombre)
      .join(", ")}\n`;
  }

  if (producto.comments) {
    summary += `  💬 Comentarios: ${producto.comments}\n`;
  }

  return summary;
}

// Función auxiliar para generar el resumen de ingredientes de pizza
function generatePizzaIngredientsSummary(ingredientes: any[]): string {
  let summary = "  🔸 Ingredientes de pizza:\n";

  const ingredientesPorMitad = {
    left: ingredientes
      .filter((ing) => ing.mitad === "left")
      .map((ing) => ing.nombre),
    right: ingredientes
      .filter((ing) => ing.mitad === "right")
      .map((ing) => ing.nombre),
    full: ingredientes
      .filter((ing) => ing.mitad === "full")
      .map((ing) => ing.nombre),
  };

  const leftIngredients = [
    ...ingredientesPorMitad.left,
    ...ingredientesPorMitad.full,
  ];
  const rightIngredients = [
    ...ingredientesPorMitad.right,
    ...ingredientesPorMitad.full,
  ];

  const formatIngredients = (ingredients: string[]) => ingredients.join(", ");

  if (
    ingredientesPorMitad.full.length > 0 &&
    leftIngredients.length === rightIngredients.length
  ) {
    summary += `    ${formatIngredients(leftIngredients)}\n`;
  } else {
    summary += `    (${formatIngredients(
      leftIngredients
    )} / ${formatIngredients(rightIngredients)})\n`;
  }

  return summary;
}

// Objeto con mensajes de estado de orden
const ORDER_STATUS_MESSAGES = {
  created: "Tu orden ha sido eliminada exitosamente. ✅",
  accepted:
    "Lo sentimos, pero esta orden ya no se puede cancelar porque ya fue aceptada por el restaurante. ⚠️",
  in_preparation:
    "Lo sentimos, pero esta orden ya está en preparación y no se puede cancelar. 👨‍🍳",
  prepared:
    "Lo sentimos, pero esta orden ya está preparada y no se puede cancelar. 🍽️",
  in_delivery:
    "Lo sentimos, pero esta orden ya está en camino y no se puede cancelar. 🚚",
  finished: "Esta orden ya ha sido finalizada y no se puede cancelar. ✨",
  canceled: "Esta orden ya ha sido cancelada previamente. ❌",
};

async function createOrderFromPreOrder(
  preOrder: PreOrder,
  customerId: string
): Promise<OrderSummaryResult> {
  try {
    const { orderItems, orderType, scheduledDeliveryTime, orderDeliveryInfo } =
      preOrder;

    const orderData: CreateOrderDto = {
      orderType,
      orderItems,
      scheduledDeliveryTime: scheduledDeliveryTime
        ? scheduledDeliveryTime.toISOString()
        : null,
      customerId,
      orderDeliveryInfo: orderDeliveryInfo as any,
    };

    const orderService = new OrderService();
    const createdOrder = await orderService.create(orderData);

    // Cargar la orden completa con todas sus relaciones
    const fullOrder = await Order.findByPk(createdOrder.id, {
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            { 
              model: Product,
              attributes: ['name', 'id']
            },
            { 
              model: ProductVariant, 
              as: "productVariant",
              attributes: ['name', 'price']
            },
            {
              model: SelectedPizzaIngredient,
              as: "selectedPizzaIngredients",
              include: [{ 
                model: PizzaIngredient,
                as: 'PizzaIngredient',
                attributes: ['name', 'id']
              }],
            },
            {
              model: SelectedModifier,
              as: "selectedModifiers",
              include: [{ 
                model: Modifier, 
                as: "modifier",
                attributes: ['name', 'price']
              }],
            },
          ],
        },
        {
          model: OrderDeliveryInfo,
          as: "orderDeliveryInfo",
        },
      ],
    });

    if (!fullOrder) {
      throw new Error("No se pudo cargar la orden creada");
    }

    // Obtener el teléfono del customerId (es el número de WhatsApp)
    const telefono = customerId.replace('@c.us', '');

    // Construir la información de entrega
    let informacionEntrega = "";
    if (orderType === "delivery" && (fullOrder as any).orderDeliveryInfo) {
      const deliveryInfo = (fullOrder as any).orderDeliveryInfo;
      const parts = [];
      if (deliveryInfo.streetAddress) parts.push(deliveryInfo.streetAddress);
      if (deliveryInfo.neighborhood) parts.push(deliveryInfo.neighborhood);
      if (deliveryInfo.city) parts.push(deliveryInfo.city);
      if (deliveryInfo.additionalDetails) parts.push(`(${deliveryInfo.additionalDetails})`);
      informacionEntrega = parts.join(", ");
    } else if (orderType === "pickup" && (fullOrder as any).orderDeliveryInfo?.pickupName) {
      informacionEntrega = (fullOrder as any).orderDeliveryInfo.pickupName;
    }

    // Calcular el precio total sumando todos los items
    let precioTotal = 0;
    const productos = fullOrder.orderItems?.map((item) => {
      const productName = item.product?.name || "Producto";
      const variantName = item.productVariant?.name || "";
      const nombre = variantName ? `${productName} ${variantName}` : productName;
      
      // Calcular precio base del producto
      let itemPrice = item.productVariant?.price || 0;
      
      // Sumar precios de modificadores
      const modificadores = item.selectedModifiers?.map((selectedMod) => ({
        nombre: selectedMod.modifier?.name || "Modificador",
        precio: selectedMod.modifier?.price || 0,
      })) || [];
      
      modificadores.forEach(mod => {
        itemPrice += mod.precio;
      });
      
      const totalItemPrice = itemPrice * item.quantity;
      precioTotal += totalItemPrice;

      // Mapear ingredientes de pizza
      const ingredientesPizza = item.selectedPizzaIngredients?.map((selectedIng) => ({
        mitad: selectedIng.half as string,
        nombre: selectedIng.PizzaIngredient?.name || "Ingrediente",
      })) || [];

      return {
        nombre,
        cantidad: item.quantity,
        precio: totalItemPrice,
        modificadores,
        ingredientes_pizza: ingredientesPizza.length > 0 ? ingredientesPizza : undefined,
        comments: item.comments,
      };
    }) || [];

    // Formatear fechas
    const fechaCreacion = fullOrder.createdAt.toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const horarioEntregaProgramado = fullOrder.scheduledDeliveryTime
      ? fullOrder.scheduledDeliveryTime.toLocaleString('es-MX', {
          timeZone: 'America/Mexico_City',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

    // Crear el objeto NewOrder con el mapeo correcto
    const newOrder: NewOrder = {
      id: fullOrder.id,
      telefono,
      informacion_entrega: informacionEntrega,
      precio_total: precioTotal,
      fecha_creacion: fechaCreacion,
      horario_entrega_programado: horarioEntregaProgramado,
      tiempoEstimado: fullOrder.estimatedTime,
      productos,
    };

    const tipoOrdenTraducido =
      orderType === "delivery" ? "A domicilio" : "Recolección";

    let orderSummary = `🎉 *¡Tu orden #${fullOrder.dailyOrderNumber} ha sido creada exitosamente!* 🎉\n\n`;
    orderSummary += `📞 *Telefono:* ${newOrder.telefono}\n`;
    orderSummary += `📅 *Fecha de creación:* ${newOrder.fecha_creacion}\n`;
    orderSummary += `🚚 *Informacion de entrega :* ${tipoOrdenTraducido} - ${newOrder.informacion_entrega}\n`;
    orderSummary += `⏱️ *Tiempo estimado:* ${newOrder.tiempoEstimado} minutos\n`;

    if (newOrder.horario_entrega_programado) {
      orderSummary += `📅 *Entrega programada:* ${newOrder.horario_entrega_programado}\n`;
    }
    orderSummary += `\n🛒 *Productos:*\n`;
    newOrder.productos.forEach((producto) => {
      orderSummary += generateProductSummary(producto);
    });

    orderSummary += `\n💰 *Total: $${newOrder.precio_total}*`;
    orderSummary += `\n\n¡Gracias por tu pedido! 😊🍽️`;
    orderSummary += `\nEn unos momentos recibirás la confirmación de recepción por parte del restaurante.`;

    return { newOrder, orderSummary };
  } catch (error) {
    logger.error(
      "Error detallado en createOrderFromPreOrder:",
      (error as any).response?.data || (error as Error).message
    );
    throw error;
  }
}

export async function handlePreOrderConfirmation(
  customerId: string,
  messageId: string
): Promise<void> {
  try {
    const preOrder = await PreOrder.findOne({
      where: { messageId },
      include: [{ model: OrderDeliveryInfo, as: "orderDeliveryInfo" }],
    });

    if (!preOrder) {
      await sendWhatsAppMessage(
        customerId,
        "Lo siento, esa preorden ya no se encuentra disponible. Solo puede haber una preorden activa por cliente."
      );
      return;
    }

    const { newOrder, orderSummary } = await createOrderFromPreOrder(
      preOrder,
      customerId
    );

    const interactiveOptions = {
      type: "list",
      body: {
        text: orderSummary,
      },
      footer: {
        text: "Selecciona una opción si es necesario:",
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
              // {
              //   id: "pay_online",
              //   title: "Pagar en línea",
              // },
            ],
          },
        ],
      },
    };

    const confirmationMessageId = await sendWhatsAppInteractiveMessage(
      customerId,
      interactiveOptions
    );

    // await sendWhatsAppNotification("Se ha creado un nuevo pedido");

    if (confirmationMessageId) {
      await Order.update(
        { messageId: confirmationMessageId },
        { where: { id: newOrder.id } }
      );
    }

    await preOrder.destroy();
    const customer = await Customer.findOne({ where: { customerId } });
    await customer.update({ relevantChatHistory: [] });
  } catch (error) {
    logger.error("Error al confirmar la orden:", error);
    await sendWhatsAppMessage(
      customerId,
      "Hubo un error al procesar tu orden. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}

export async function handlePreOrderDiscard(
  customerId: string,
  messageId: string
): Promise<void> {
  try {
    const preOrder = await PreOrder.findOne({ where: { messageId } });

    if (!preOrder) {
      await sendWhatsAppMessage(
        customerId,
        "❌ Esta preorden ya no está disponible para descartar. 🚫🗑️"
      );
      return;
    }
    await preOrder.destroy();

    const customer = await Customer.findOne({ where: { customerId } });
    await customer.update({ relevantChatHistory: [] });

    const confirmationMessage =
      "✅ Tu preorden ha sido descartada y el historial de conversación reciente ha sido borrado. 🗑️ ¿En qué más puedo ayudarte? 😊";
    await sendWhatsAppMessage(customerId, confirmationMessage);
  } catch (error) {
    logger.error("Error al descartar la preorden:", error);
    await sendWhatsAppMessage(
      customerId,
      "❌ Hubo un error al procesar tu solicitud. 🚫 Por favor, intenta nuevamente o contacta con el restaurante. 📞"
    );
  }
}

export async function handleOrderCancellation(
  customerId: string,
  messageId: string
): Promise<void> {
  try {
    const order = await Order.findOne({ where: { messageId } });
    if (!order) {
      await sendWhatsAppMessage(
        customerId,
        "Lo siento, no se pudo encontrar tu orden para cancelar 🔍❌"
      );
      return;
    }

    const mensaje =
      ORDER_STATUS_MESSAGES[order.status] ||
      "Lo sentimos, pero no podemos procesar tu solicitud de cancelación en este momento ⚠️";

    if (order.status === "created") {
      await order.destroy();
    }

    await sendWhatsAppMessage(customerId, mensaje);
    // await sendWhatsAppNotification("Se ha cancelado un pedido");
  } catch (error) {
    logger.error("Error al eliminar la orden:", error);
    await sendWhatsAppMessage(
      customerId,
      "Hubo un error al procesar tu solicitud de eliminación ❌🚫"
    );
  }
}

export async function handleOrderModification(
  customerId: string,
  messageId: string
): Promise<void> {
  const customer = await Customer.findOne({ where: { customerId } });
  await customer.update({ relevantChatHistory: [] });

  try {
    const order = await Order.findOne({
      where: { messageId },
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            { model: Product },
            { model: ProductVariant, as: "productVariant" },
            {
              model: SelectedPizzaIngredient,
              as: "selectedPizzaIngredients",
              include: [{ model: PizzaIngredient, as: 'PizzaIngredient' }],
            },
            {
              model: SelectedModifier,
              as: "selectedModifiers",
              include: [{ model: Modifier, as: "modifier" }],
            },
          ],
        },
      ],
    });

    logger.info("order", JSON.stringify(order));

    if (!order) {
      const mensajeError =
        "Lo sentimos, no se pudo encontrar tu orden para modificar, ya no esta disponible. 🔍😞";
      logger.error(`Orden no encontrada para messageId: ${messageId}`);
      await sendWhatsAppMessage(customerId, mensajeError);
      return;
    }

    let mensaje: string;
    let canModify = false;

    switch (order.status) {
      case "created":
        canModify = true;
        mensaje = `Tu orden #${order.dailyOrderNumber} será eliminada y se generará una nueva preorden que podrás modificar. ♻️ Por favor, espera mientras procesamos los cambios... ⏳`;
        break;
      case "accepted":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya fue aceptada. ✅ Por favor, contacta directamente con el restaurante si necesitas hacer cambios. 📞";
        break;
      case "in_preparation":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya está en preparación. 👨‍🍳 Por favor, contacta directamente con el restaurante si necesitas hacer cambios. 📞";
        break;
      case "prepared":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya está preparada. 🍽️ Por favor, contacta directamente con el restaurante si necesitas hacer cambios. 📞";
        break;
      case "in_delivery":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya está en camino. 🚚 Por favor, contacta directamente con el restaurante o el repartidor si necesitas hacer cambios. 📞";
        break;
      case "finished":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya fue finalizada. ✨ Por favor, contacta directamente con el restaurante si necesitas hacer cambios. 📞";
        break;
      case "canceled":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya fue cancelada. ❌ Por favor, contacta directamente con el restaurante si necesitas hacer cambios. 📞";
        break;
      default:
        mensaje =
          "Lo sentimos, pero no podemos procesar tu solicitud de modificación en este momento. ⚠️ Por favor, contacta directamente con el restaurante para obtener ayuda. 📞";
    }

    await sendWhatsAppMessage(customerId, mensaje);

    if (!canModify) {
      return;
    }

    // Extraer los datos necesarios antes de eliminar la orden
    const { orderType, scheduledDeliveryTime, orderItems } = order;
    // Eliminar la orden existente en lugar de cancelarla
    await order.destroy();

    const filteredOrderItems = orderItems.map((item) => {
      const filteredItem: any = {
        quantity: item.quantity,
        productId: item.productId,
        productVariant: {
          productVariantId: item.productVariant.id,
        },
      };

      if (item.comments) filteredItem.comments = item.comments;
      if (
        item.selectedPizzaIngredients &&
        item.selectedPizzaIngredients.length > 0
      ) {
        filteredItem.selectedPizzaIngredients = item.selectedPizzaIngredients;
      }
      if (item.selectedModifiers && item.selectedModifiers.length > 0) {
        filteredItem.selectedModifiers = item.selectedModifiers;
      }

      return filteredItem;
    });

    // Crear una nueva preorden utilizando selectProducts
    try {
      const preOrderService = new PreOrderService();
      const selectProductsResponse = await preOrderService.selectProducts({
        orderItems: filteredOrderItems,
        customerId,
        orderType,
        scheduledDeliveryTime,
      });

      if (selectProductsResponse.status !== 200) {
        throw new Error(
          selectProductsResponse.json.text ||
            "Error desconocido al crear la nueva preorden"
        );
      }

      // Actualizar el historial del chat
      const customer = await Customer.findOne({ where: { customerId } });
      if (!customer) {
        throw new Error("No se pudo encontrar el cliente");
      }

      let relevantChatHistory = JSON.parse(
        typeof customer.relevantChatHistory === "string"
          ? customer.relevantChatHistory
          : "[]"
      );
      let fullChatHistory = JSON.parse(
        typeof customer.fullChatHistory === "string"
          ? customer.fullChatHistory
          : "[]"
      );

      // Agregar el mensaje de texto al historial
      const assistantMessage = {
        role: "assistant",
        content: selectProductsResponse.json.text,
      };
      relevantChatHistory.push(assistantMessage);
      fullChatHistory.push(assistantMessage);

      await customer.update({
        relevantChatHistory: relevantChatHistory,
        fullChatHistory: fullChatHistory,
      });

      // Enviar mensaje interactivo si existe
      if (selectProductsResponse.json.interactiveMessage) {
        const messageId = await sendWhatsAppInteractiveMessage(
          customerId,
          selectProductsResponse.json.interactiveMessage
        );
        // await sendWhatsAppNotification("Se ha modificado un pedido");

        // Actualizar la preorden con el messageId si existe
        if (selectProductsResponse.json.preOrderId && messageId) {
          const preOrder = await PreOrder.findByPk(
            selectProductsResponse.json.preOrderId
          );
          if (preOrder) {
            await preOrder.update({ messageId });
          }
        }
      }
    } catch (error) {
      logger.error("Error al crear la nueva preorden:", error);
      const errorMessage =
        error.message ||
        "Error al procesar tu solicitud de modificación. Por favor, inténtalo de nuevo o contacta con el restaurante.";
      await sendWhatsAppMessage(customerId, errorMessage);
    }
  } catch (error) {
    logger.error("Error al modificar la orden:", error);
    await sendWhatsAppMessage(
      customerId,
      "Hubo un error al procesar tu solicitud de modificación. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}
