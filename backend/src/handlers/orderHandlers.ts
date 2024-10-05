import axios from "axios";
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
} from "../models";

import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "../utils/whatsAppUtils";
import { OrderService } from "../services/order.service";
import { PreOrderService } from "../services/pre-order.service";

import * as dotenv from "dotenv";
import { CreateOrderDto } from "src/dto/create-order.dto";
dotenv.config();

interface OrderData {
  orderType: string;
  orderItems: any[];
  scheduledDeliveryTime: string | null;
  clientId: string;
  orderDeliveryInfo: any;
}

interface NewOrder {
  id: number;
  telefono: string;
  informacion_entrega: string;
  precio_total: number;
  fecha_creacion: string;
  horario_entrega_programado: string | null;
  tiempoEstimado: number;
  productos: {
    nombre: string;
    cantidad: number;
    precio: number;
    modificadores: { nombre: string; precio: number }[];
    ingredientes_pizza?: { mitad: string; nombre: string }[];
    comments?: string;
  }[];
}

interface OrderSummaryResult {
  newOrder: NewOrder;
  orderSummary: string;
}

async function createOrderFromPreOrder(
  preOrder: PreOrder,
  clientId: string
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
      clientId,
      orderDeliveryInfo: orderDeliveryInfo.dataValues,
    };

    const orderService = new OrderService();
    const { orden: newOrder } = await orderService.createOrder(orderData);

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
    if (newOrder.horario_entrega_programado) {
      orderSummary += `📅 *Fecha de entrega programada:* ${newOrder.horario_entrega_programado}\n`;
    }
    orderSummary += `⏱️ *Tiempo estimado de entrega:* ${newOrder.tiempoEstimado} minutos\n\n`;
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

        const ingredientesPorMitad: {
          left: string[];
          right: string[];
          full: string[];
        } = {
          left: [],
          right: [],
          full: [],
        };

        producto.ingredientes_pizza.forEach((ing) => {
          ingredientesPorMitad[
            ing.mitad as keyof typeof ingredientesPorMitad
          ].push(ing.nombre);
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
  } catch (error) {
    console.error(
      "Error detallado en createOrderFromPreOrder:",
      (error as any).response?.data || (error as Error).message
    );
    throw error;
  }
}

export async function handlePreOrderConfirmation(
  clientId: string,
  messageId: string
): Promise<void> {
  try {
    const preOrder = await PreOrder.findOne({
      where: { messageId },
      include: [{ model: OrderDeliveryInfo, as: "orderDeliveryInfo" }],
    });

    if (!preOrder) {
      await sendWhatsAppMessage(
        clientId,
        "Lo siento, esa preorden ya no se encuentra disponible. Solo puede haber una preorden activa por cliente."
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

    const customer = await Customer.findOne({ where: { clientId } });

    await customer?.update({ relevantChatHistory: [] });
  } catch (error) {
    console.error("Error al confirmar la orden:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al procesar tu orden. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}

export async function handlePreOrderDiscard(
  clientId: string,
  messageId: string
): Promise<void> {
  try {
    const preOrder = await PreOrder.findOne({ where: { messageId } });

    if (!preOrder) {
      await sendWhatsAppMessage(clientId, "Esta preorden ya fue descartada.");
      return;
    }
    await preOrder.destroy();

    const customer = await Customer.findOne({ where: { clientId } });
    await customer?.update({ relevantChatHistory: [] });

    const confirmationMessage =
      "Tu preorden ha sido descartada y el historial de conversación reciente ha sido borrado. ¿En qué más puedo ayudarte?";
    await sendWhatsAppMessage(clientId, confirmationMessage);
  } catch (error) {
    console.error("Error al descartar la preorden:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al procesar tu solicitud. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}

export async function handleOrderCancellation(
  clientId: string,
  messageId: string
): Promise<void> {
  try {
    console.log("handleOrderCancellation messageId", messageId);
    const order = await Order.findOne({ where: { messageId } });
    console.log("order", order);

    const customer = await Customer.findOne({ where: { clientId } });
    await customer.update({ relevantChatHistory: [] });
    console.log("customer", customer);
    if (!order) {
      console.error(`No se encontró orden para el messageId: ${messageId}`);
      await sendWhatsAppMessage(
        clientId,
        "Lo siento, no se pudo encontrar tu orden para cancelar. Por favor, contacta con el restaurante si necesitas ayuda."
      );
      return;
    }
    let mensaje: string;
    switch (order.status) {
      case "created":
        console.log(
          "Orden encontrada con estado 'created'. Intentando eliminar..."
        );
        try {
          await Order.destroy({ where: { id: order.id } });
          console.log(`Orden #${order.id} eliminada exitosamente.`);
          mensaje = `Tu orden #${order.dailyOrderNumber} ha sido eliminada exitosamente. Si tienes alguna pregunta, por favor contacta con el restaurante.`;
        } catch (deleteError) {
          console.error(
            `Error al eliminar la orden #${order.id}:`,
            deleteError
          );
          mensaje =
            "Hubo un problema al eliminar tu orden. Por favor, contacta con el restaurante para asistencia.";
        }

        // Verificar si la orden aún existe después de intentar eliminarla
        const orderStillExists = await Order.findByPk(order.id);
        if (orderStillExists) {
          console.error(
            `La orden #${order.id} aún existe después de intentar eliminarla.`
          );
          mensaje =
            "Hubo un problema al procesar tu solicitud. Por favor, contacta con el restaurante para asistencia.";
        }
        break;

      case "accepted":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede cancelar porque ya fue aceptada por el restaurante. Por favor, contacta directamente con el restaurante si necesitas hacer cambios.";
        break;
      case "in_preparation":
        mensaje =
          "Lo sentimos, pero esta orden ya está en preparación y no se puede cancelar. Por favor, contacta directamente con el restaurante si tienes alguna inquietud.";
        break;
      case "prepared":
        mensaje =
          "Lo sentimos, pero esta orden ya está preparada y no se puede cancelar. Por favor, contacta directamente con el restaurante para resolver cualquier problema.";
        break;
      case "in_delivery":
        mensaje =
          "Lo sentimos, pero esta orden ya está en camino y no se puede cancelar. Por favor, contacta directamente con el restaurante o el repartidor si necesitas hacer algún cambio.";
        break;
      case "finished":
        mensaje =
          "Esta orden ya ha sido finalizada y no se puede cancelar. Si tienes algún problema con tu pedido, por favor contacta directamente con el restaurante.";
        break;
      case "canceled":
        mensaje =
          "Esta orden ya ha sido cancelada previamente. No es necesario realizar ninguna acción adicional.";
        break;
      default:
        mensaje =
          "Lo sentimos, pero no podemos procesar tu solicitud de cancelación en este momento. Por favor, contacta directamente con el restaurante para obtener ayuda.";
    }
    console.log("mensaje", mensaje);
    await sendWhatsAppMessage(clientId, mensaje);
  } catch (error) {
    console.error("Error al eliminar la orden:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al procesar tu solicitud de eliminación. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}

export async function handleOrderModification(
  clientId: string,
  messageId: string
): Promise<void> {
  const customer = await Customer.findOne({ where: { clientId } });
  await customer?.update({ relevantChatHistory: [] });

  try {
    const order = await Order.findOne({
      where: { messageId },
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            { model: Product },
            { model: ProductVariant },
            {
              model: SelectedPizzaIngredient,
              as: "selectedPizzaIngredients",
              include: [{ model: PizzaIngredient }],
            },
            {
              model: SelectedModifier,
              as: "selectedModifiers",
              include: [{ model: Modifier }],
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new Error("Orden no encontrada");
    }

    let mensaje: string;
    let canModify = false;

    switch (order.status) {
      case "created":
        canModify = true;
        mensaje = `Tu orden #${order.dailyOrderNumber} será eliminada y se generará una nueva preorden que podrás modificar. Por favor, espera mientras procesamos los cambios...`;
        break;
      case "accepted":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya fue aceptada. Por favor, contacta directamente con el restaurante si necesitas hacer cambios.";
        break;
      case "in_preparation":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya esta en preparación. Por favor, contacta directamente con el restaurante si necesitas hacer cambios.";
        break;
      case "prepared":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya esta preparada. Por favor, contacta directamente con el restaurante si necesitas hacer cambios.";
        break;
      case "in_delivery":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya esta en camino. Por favor, contacta directamente con el restaurante o el repartidor si necesitas hacer cambios.";
        break;
      case "finished":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya fue finalizada. Por favor, contacta directamente con el restaurante si necesitas hacer cambios.";
        break;
      case "canceled":
        mensaje =
          "Lo sentimos, pero esta orden ya no se puede modificar debido a que ya fue cancelada. Por favor, contacta directamente con el restaurante si necesitas hacer cambios.";
        break;
      default:
        mensaje =
          "Lo sentimos, pero no podemos procesar tu solicitud de modificación en este momento. Por favor, contacta directamente con el restaurante para obtener ayuda.";
    }

    await sendWhatsAppMessage(clientId, mensaje);

    if (!canModify) {
      return;
    }

    // Extraer los datos necesarios antes de eliminar la orden
    const { orderType, scheduledDeliveryTime, orderItems } = order;

    // Eliminar la orden existente en lugar de cancelarla
    await order.destroy();

    const formattedScheduledDeliveryTime = new Date(
      scheduledDeliveryTime
    ).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const filteredOrderItems = orderItems.map((item) => {
      const filteredItem: any = {
        quantity: item.quantity,
        productId: item.productId,
        productVariantId: item.productVariantId,
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
        clientId,
        orderType,
        scheduledDeliveryTime: formattedScheduledDeliveryTime,
      });

      if (selectProductsResponse.status !== 200) {
        throw new Error(
          selectProductsResponse.json.mensaje ||
            "Error desconocido al crear la nueva preorden"
        );
      }

      const customer = await Customer.findOne({ where: { clientId } });
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

      const assistantMessage = {
        role: "assistant",
        content: selectProductsResponse.json.mensaje,
      };

      relevantChatHistory.push(assistantMessage);
      fullChatHistory.push(assistantMessage);

      await customer.update({
        relevantChatHistory: relevantChatHistory,
        fullChatHistory: fullChatHistory,
        lastInteraction: new Date(),
      });
    } catch (error) {
      console.error("Error al crear la nueva preorden:", error);
      const errorMessage =
        error.message ||
        "Error al procesar tu solicitud de modificación. Por favor, inténtalo de nuevo o contacta con el restaurante.";
      await sendWhatsAppMessage(clientId, errorMessage);
    }
  } catch (error) {
    console.error("Error al modificar la orden:", error);
    await sendWhatsAppMessage(
      clientId,
      "Hubo un error al procesar tu solicitud de modificación. Por favor, intenta nuevamente o contacta con el restaurante."
    );
  }
}
