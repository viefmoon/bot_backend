import dotenv from "dotenv";
dotenv.config();
const {
  Product,
  ProductVariant,
  PizzaIngredient,
  Modifier,
  ModifierType,
  RestaurantConfig,
  PreOrder,
} = require("../../../models");
import { sendWhatsAppInteractiveMessage } from "../../../utils/whatsAppUtils";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    orderItems,
    clientId,
    orderType,
    deliveryInfo,
    scheduledDeliveryTime,
  } = req.body;

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return res
      .status(400)
      .json({ error: "Se requiere un array de orderItems" });
  }

  let totalCost = 0;
  let fullScheduledDeliveryTime = null;

  if (scheduledDeliveryTime) {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    fullScheduledDeliveryTime = new Date(
      `${today}T${scheduledDeliveryTime}:00-06:00`
    );

    const config = await RestaurantConfig.findOne();
    if (!config) {
      return res
        .status(400)
        .json({ error: "No se encontró la configuración del restaurante" });
    }

    const minTimeRequired =
      orderType === "pickup"
        ? config.estimatedPickupTime
        : config.estimatedDeliveryTime;
    const timeDifference = (fullScheduledDeliveryTime - now) / (1000 * 60);

    if (timeDifference < minTimeRequired) {
      return res.status(400).json({
        error: `La hora programada debe ser al menos ${minTimeRequired} minutos después de la hora actual.`,
      });
    }
  }

  try {
    const calculatedItems = await Promise.all(
      orderItems.map(async (item) => {
        let product, productVariant;
        let itemPrice, productName;

        product = await Product.findByPk(item.productId);

        if (!product) {
          productVariant = await ProductVariant.findByPk(item.productId);
          if (!productVariant) {
            throw new Error(
              `Producto o variante no encontrado en el menú: ${item.productId}`
            );
          }
          product = await Product.findByPk(productVariant.productId);
          itemPrice = productVariant.price || 0;
          productName = productVariant.name;
          item.productVariantId = item.productId;
          item.productId = product.id;
        } else {
          itemPrice = product.price || 0;
          productName = product.name;
          item.productVariantId = null;
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

    const config = await RestaurantConfig.findOne();
    if (!config) {
      throw new Error("No se encontró la configuración del restaurante");
    }

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

    messageContent += `🏠 *Información de entrega*: ${
      deliveryInfo || "No disponible"
    }\n`;
    relevantMessageContent += `Información de entrega: ${
      deliveryInfo || "No disponible"
    }\n`;
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

    if (!messageId) {
      throw new Error("No se pudo enviar el mensaje de WhatsApp");
    }

    const preOrder = await PreOrder.create({
      orderItems,
      orderType,
      deliveryInfo,
      scheduledDeliveryTime: fullScheduledDeliveryTime,
      messageId,
    });

    return res.status(200).json({
      mensaje: relevantMessageContent,
      preOrderId: preOrder.id,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
