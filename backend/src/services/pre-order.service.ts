import {
  Product,
  ProductVariant,
  PizzaIngredient,
  Modifier,
  ModifierType,
  RestaurantConfig,
  PreOrder,
  CustomerDeliveryInfo,
  OrderDeliveryInfo,
} from "../models";
import { sendWhatsAppInteractiveMessage } from "../utils/whatsAppUtils";

export class PreOrderService {
  async selectProducts(orderData: {
    orderItems: any[];
    clientId: string;
    orderType: string;
    scheduledDeliveryTime?: string;
  }) {
    const { orderItems, clientId, orderType, scheduledDeliveryTime } =
      orderData;
    let totalCost = 0;
    let fullScheduledDeliveryTime: Date | null = null;

    const config = await RestaurantConfig.findOne();
    if (!config) {
      throw new Error("Configuración del restaurante no encontrada.");
    }

    // Validar tiempo de entrega programado
    if (scheduledDeliveryTime) {
      const today = new Date().toISOString().split("T")[0];
      const now = new Date();

      fullScheduledDeliveryTime = new Date(
        `${today}T${scheduledDeliveryTime}:00-06:00`
      );

      const minTimeRequired =
        orderType === "pickup"
          ? config.estimatedPickupTime
          : config.estimatedDeliveryTime;
      const timeDifference =
        (fullScheduledDeliveryTime.getTime() - now.getTime()) / (1000 * 60);

      if (timeDifference < minTimeRequired) {
        throw new Error(
          `La hora programada debe ser al menos ${minTimeRequired} minutos después de la hora actual.`
        );
      }
    }

    // Obtener información de entrega del cliente
    const customerDeliveryInfo = await CustomerDeliveryInfo.findOne({
      where: { clientId },
    });
    if (!customerDeliveryInfo) {
      throw new Error("Información de entrega del cliente no encontrada.");
    }

    let deliveryInfoData = {};

    if (orderType === "delivery") {
      deliveryInfoData = {
        streetAddress: customerDeliveryInfo.streetAddress,
        neighborhood: customerDeliveryInfo.neighborhood,
        postalCode: customerDeliveryInfo.postalCode,
        city: customerDeliveryInfo.city,
        state: customerDeliveryInfo.state,
        country: customerDeliveryInfo.country,
        latitude: customerDeliveryInfo.latitude,
        longitude: customerDeliveryInfo.longitude,
        geocodedAddress: customerDeliveryInfo.geocodedAddress,
        additionalDetails: customerDeliveryInfo.additionalDetails,
      };
    } else if (orderType === "pickup") {
      deliveryInfoData = {
        pickupName: customerDeliveryInfo.pickupName,
      };
    }

    // Crear información de entrega para la orden
    const orderDeliveryInfo = await OrderDeliveryInfo.create(deliveryInfoData);

    // Calcular items y precios
    const calculatedItems = await Promise.all(
      orderItems.map(async (item) => {
        let product, productVariant;
        let itemPrice, productName;

        if (item.productId && item.productVariantId) {
          // Si ambos están presentes, buscar producto y variante
          product = await Product.findByPk(item.productId);
          productVariant = await ProductVariant.findByPk(item.productVariantId);

          if (!product || !productVariant) {
            throw new Error(
              `Producto o variante no encontrado en el menú: Producto ${item.productId}, Variante ${item.productVariantId}`
            );
          }

          itemPrice = productVariant.price || 0;
          productName = productVariant.name;
          item.productVariantId = productVariant.id;
          item.productId = product.id;
        } else if (item.productId) {
          // Primero, intentar buscar el producto
          product = await Product.findByPk(item.productId);

          if (!product) {
            // Si no se encuentra el producto, verificar si es una variante
            productVariant = await ProductVariant.findByPk(item.productId);

            if (!productVariant) {
              throw new Error(
                `Producto o variante no encontrado en el menú: ${item.productId}`
              );
            }

            product = await Product.findByPk(productVariant.productId);
            itemPrice = productVariant.price || 0;
            productName = productVariant.name;
            item.productVariantId = productVariant.id;
            item.productId = product.id;
          } else {
            itemPrice = product.price || 0;
            productName = product.name;
            item.productVariantId = null;
            item.productId = product.id;
          }
        }

        if (
          product.id === "PZ" &&
          (!item.selectedPizzaIngredients ||
            item.selectedPizzaIngredients.length === 0)
        ) {
          throw new Error(
            `El producto "${productName}" requiere al menos un ingrediente de pizza`
          );
        }

        // Calcular precio adicional por ingredientes de pizza
        if (
          item.selectedPizzaIngredients &&
          item.selectedPizzaIngredients.length > 0
        ) {
          let totalIngredientValue = 0;
          let halfIngredientValue = { left: 0, right: 0 };

          for (const ingredient of item.selectedPizzaIngredients) {
            const pizzaIngredient = await PizzaIngredient.findByPk(
              ingredient.pizzaIngredientId
            );
            if (!pizzaIngredient) {
              throw new Error(
                `Ingrediente de pizza no encontrado en el menu: ${ingredient.pizzaIngredientId}`
              );
            }
            const ingredientValue =
              ingredient.action === "add"
                ? pizzaIngredient.ingredientValue
                : -pizzaIngredient.ingredientValue;

            if (ingredient.half === "full") {
              totalIngredientValue += ingredientValue;
            } else {
              halfIngredientValue[ingredient.half] += ingredientValue;
            }
          }

          if (totalIngredientValue > 4) {
            itemPrice += (totalIngredientValue - 4) * 10;
          }

          for (const half in halfIngredientValue) {
            if (halfIngredientValue[half] > 4) {
              itemPrice += (halfIngredientValue[half] - 4) * 5;
            }
          }
        }

        // Validar y calcular precio de modificadores
        if (item.selectedModifiers && item.selectedModifiers.length > 0) {
          const modifierTypes = await ModifierType.findAll({
            where: { productId: item.productId },
            include: [{ model: Modifier, as: "modifiers" }],
          });

          for (const modifierType of modifierTypes) {
            const selectedModifiers = item.selectedModifiers.filter((mod) =>
              modifierType.modifiers.some((m) => m.id === mod.modifierId)
            );

            for (const selectedMod of selectedModifiers) {
              const modifier = modifierType.modifiers.find(
                (mod) => mod.id === selectedMod.modifierId
              );
              if (!modifier) {
                throw new Error(
                  `Modificador no encontrado en el menú: ${selectedMod.modifierId}`
                );
              }
              itemPrice += modifier.price;
            }
          }
        }

        const totalItemPrice = itemPrice * item.quantity;
        totalCost += totalItemPrice;

        // Obtener nombres de modificadores
        let modifierNames = [];
        if (item.selectedModifiers && item.selectedModifiers.length > 0) {
          modifierNames = await Promise.all(
            item.selectedModifiers.map(async (modifier) => {
              const mod = await Modifier.findByPk(modifier.modifierId);
              if (!mod) {
                throw new Error(
                  `Modificador no encontrado en el menú: ${modifier.modifierId}`
                );
              }
              return mod.name;
            })
          );
        }

        // Obtener nombres de ingredientes de pizza
        let pizzaIngredientNames = { left: [], right: [], full: [] };
        if (
          item.selectedPizzaIngredients &&
          item.selectedPizzaIngredients.length > 0
        ) {
          await Promise.all(
            item.selectedPizzaIngredients.map(async (ingredient) => {
              const pizzaIngredient = await PizzaIngredient.findByPk(
                ingredient.pizzaIngredientId
              );
              if (!pizzaIngredient) {
                throw new Error(
                  `Ingrediente de pizza no encontrado en el menú: ${ingredient.pizzaIngredientId}`
                );
              }
              const ingredientName =
                ingredient.action === "remove"
                  ? `Sin ${pizzaIngredient.name}`
                  : ingredient.action === "add"
                  ? `Con ${pizzaIngredient.name}`
                  : pizzaIngredient.name;
              if (ingredient.half === "full") {
                pizzaIngredientNames.full.push(ingredientName);
              } else {
                pizzaIngredientNames[ingredient.half].push(ingredientName);
              }
            })
          );
        }

        return {
          ...item,
          precio_total_orderItem: totalItemPrice,
          nombre_producto: productName,
          modificadores: modifierNames,
          ingredientes_pizza: pizzaIngredientNames,
        };
      })
    );

    const estimatedTime = fullScheduledDeliveryTime
      ? fullScheduledDeliveryTime.toLocaleString("es-MX", {
          timeZone: "America/Mexico_City",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      : orderType === "pickup"
      ? `${config.estimatedPickupTime} minutos`
      : `${config.estimatedDeliveryTime} minutos`;

    let messageContent =
      "Aquí tienes el resumen de tu pedido, informame si tienes algun cambio o deseas agregar algun producto mas.\n\n";
    let relevantMessageContent =
      "Resumen del pedido hasta este momento, informame si tienes algun cambio o deseas agregar algun producto mas.\n\n";

    let deliveryInfo;
    if (orderType === "delivery") {
      deliveryInfo = orderDeliveryInfo.streetAddress;
    } else if (orderType === "pickup") {
      deliveryInfo = orderDeliveryInfo.pickupName;
    }

    messageContent += `🏠 *Información de ${
      orderType === "delivery" ? "entrega" : "recolección"
    }*: ${deliveryInfo || "No disponible"}\n`;
    relevantMessageContent += `Información de ${
      orderType === "delivery" ? "entrega" : "recolección"
    }: ${deliveryInfo || "No disponible"}\n`;
    messageContent += `⏱️ *Tiempo estimado de ${
      orderType === "pickup"
        ? "recolección en el restaurante"
        : "entrega a domicilio"
    }: ${estimatedTime}*\n\n`;

    calculatedItems.forEach((item) => {
      messageContent += `- *${item.quantity}x ${item.nombre_producto}*: $${item.precio_total_orderItem}\n`;
      relevantMessageContent += `- *${item.quantity}x ${item.nombre_producto}*\n`;

      if (
        item.ingredientes_pizza.full.length > 0 ||
        item.ingredientes_pizza.left.length > 0 ||
        item.ingredientes_pizza.right.length > 0
      ) {
        messageContent += "  🔸 Ingredientes de pizza:\n";
        relevantMessageContent += "  Ingredientes de pizza:\n";

        if (item.ingredientes_pizza.full.length > 0) {
          messageContent += `    Completa: ${item.ingredientes_pizza.full.join(
            ", "
          )}\n`;
          relevantMessageContent += `    Completa: ${item.ingredientes_pizza.full.join(
            ", "
          )}\n`;
        }
        if (item.ingredientes_pizza.left.length > 0) {
          messageContent += `    Mitad izquierda: ${item.ingredientes_pizza.left.join(
            ", "
          )}\n`;
          relevantMessageContent += `    Mitad izquierda: ${item.ingredientes_pizza.left.join(
            ", "
          )}\n`;
        }
        if (item.ingredientes_pizza.right.length > 0) {
          messageContent += `    Mitad derecha: ${item.ingredientes_pizza.right.join(
            ", "
          )}\n`;
          relevantMessageContent += `    Mitad derecha: ${item.ingredientes_pizza.right.join(
            ", "
          )}\n`;
        }
      }

      if (item.modificadores.length > 0) {
        messageContent += `  🔸 Modificadores: ${item.modificadores.join(
          ", "
        )}\n`;
        relevantMessageContent += `  Modificadores: ${item.modificadores.join(
          ", "
        )}\n`;
      }

      if (item.comments) {
        messageContent += `  💬 Comentarios: ${item.comments}\n`;
        relevantMessageContent += `  Comentarios: ${item.comments}\n`;
      }
    });

    messageContent += `\n💰 *Total: $${totalCost}*`;

    // Enviar mensaje interactivo
    const messageId = await sendWhatsAppInteractiveMessage(clientId, {
      type: "button",
      header: {
        type: "text",
        text: "Resumen del Pedido",
      },
      body: {
        text: messageContent,
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "discard_order",
              title: "Descartar Orden",
            },
          },
          {
            type: "reply",
            reply: {
              id: "confirm_order",
              title: "Confirmar Orden",
            },
          },
        ],
      },
    });

    // Borrar todas las preórdenes asociadas al cliente
    await PreOrder.destroy({ where: { clientId } });

    const preOrder = await PreOrder.create({
      orderItems,
      orderType: orderType as "delivery" | "pickup",
      scheduledDeliveryTime: fullScheduledDeliveryTime,
      clientId,
      messageId,
    });

    // Actualizar información de entrega
    await orderDeliveryInfo.update({
      preOrderId: preOrder.id,
    });
    return {
      status: 200,
      json: { mensaje: relevantMessageContent },
    };
  }
  catch(error) {
    return {
      status: 400,
      json: { error: error.message },
    };
  }
}
