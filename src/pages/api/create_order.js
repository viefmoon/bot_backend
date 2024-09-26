import dotenv from "dotenv";
dotenv.config();
const Order = require("../../models/order");
const Customer = require("../../models/customer");
const OrderItem = require("../../models/orderItem");
const Product = require("../../models/product");
const ProductVariant = require("../../models/productVariant");
const PizzaIngredient = require("../../models/pizzaIngredient");
const Modifier = require("../../models/modifier");
const ModifierType = require("../../models/modifierType");
const SelectedModifier = require("../../models/selectedModifier");
const {
  SelectedPizzaIngredient,
} = require("../../models/selectedPizzaIngredient");
const { verificarHorarioAtencion } = require("../../utils/timeUtils");
const { getNextDailyOrderNumber } = require("../../utils/orderUtils");
const RestaurantConfig = require("../../models/restaurantConfig");
const PreOrder = require("../../models/preOrder");
const axios = require("axios");

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { action } = req.body;

      switch (action) {
        case "create":
          return await createOrder(req, res);
        case "modify":
          return await modifyOrder(req, res);
        case "selectProducts":
          return await selectProducts(req, res);
        default:
          return res.status(400).json({ error: "Acción no válida" });
      }
    } catch (error) {
      console.error("Error en la operación:", error);
      res.status(500).json({ error: "Error en la operación" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function createOrder(req, res) {
  const { orderType, orderItems, deliveryInfo, clientId } = req.body;

  const config = await RestaurantConfig.findOne();
  if (!config || !config.acceptingOrders) {
    return res.status(400).json({
      error:
        "Lo sentimos, el restaurante no está aceptando pedidos en este momento, puedes intentar mas tarde o llamar al restaurante.",
    });
  }

  const estaAbierto = await verificarHorarioAtencion();
  if (!estaAbierto) {
    return res.status(400).json({
      error:
        "Lo sentimos, solo podre procesar tu pedido cuando el restaurante este abierto.",
    });
  }

  if (clientId) {
    const updateData = {};
    updateData.deliveryInfo = deliveryInfo;

    try {
      let customer = await Customer.findByPk(clientId);
      if (customer) {
        await customer.update(updateData);
      } else {
        customer = await Customer.create({
          clientId: clientId,
          ...updateData,
        });
      }
    } catch (error) {
      console.error("Error al crear o actualizar el cliente:", error);
    }
  } else {
    console.warn("clientId no proporcionado o inválido:", clientId);
  }

  const mexicoTime = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  });
  const today = new Date(mexicoTime).toISOString().split("T")[0];
  const dailyOrderNumber = await getNextDailyOrderNumber();

  // Determinar el tiempo estimado basado en el tipo de orden
  const estimatedTime =
    orderType === "pickup"
      ? config.estimatedPickupTime
      : config.estimatedDeliveryTime;

  // Crear la orden
  const newOrder = await Order.create({
    dailyOrderNumber,
    orderType,
    status: "created",
    deliveryInfo: deliveryInfo,
    totalCost: 0,
    clientId,
    orderDate: today,
    estimatedTime,
    scheduledDeliveryTime: null,
  });

  // Crear los items asociados a la orden
  const createdItems = await Promise.all(
    orderItems.map(async (item) => {
      // Obtener el producto base
      const product = await Product.findByPk(item.productId);
      if (!product) {
        throw new Error(`Producto no encontrado: ${item.productId}`);
      }
      let itemPrice = product.price || 0;

      // Si hay una productVariant, usar su precio
      if (item.productVariantId) {
        const productVariant = await ProductVariant.findByPk(
          item.productVariantId
        );
        if (!productVariant) {
          throw new Error(
            `Variante de producto no encontrada: ${item.productVariantId}`
          );
        }
        itemPrice = productVariant.price || 0;
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

      // Sumar precios de modificadores
      if (item.selectedModifiers) {
        const modifierPrices = await Promise.all(
          item.selectedModifiers.map(async (modifier) => {
            const mod = await Modifier.findByPk(modifier.modifierId);
            return mod.price;
          })
        );
        itemPrice += modifierPrices.reduce((sum, price) => sum + price, 0);
      }

      // Crear el item de orden con el precio calculado
      const orderItem = await OrderItem.create({
        quantity: item.quantity,
        price: itemPrice,
        comments: item.comments,
        orderId: newOrder.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
      });

      // Crear SelectedModifiers si existen
      if (item.selectedModifiers) {
        await Promise.all(
          item.selectedModifiers.map((modifier) =>
            SelectedModifier.create({
              orderItemId: orderItem.id,
              modifierId: modifier.modifierId,
            })
          )
        );
      }
      // Crear SelectedPizzaIngredients si existen
      if (item.selectedPizzaIngredients) {
        await Promise.all(
          item.selectedPizzaIngredients.map((ingredient) =>
            SelectedPizzaIngredient.create({
              orderItemId: orderItem.id,
              pizzaIngredientId: ingredient.pizzaIngredientId,
              half: ingredient.half,
              action: ingredient.action,
            })
          )
        );
      }

      return orderItem;
    })
  );

  const totalCost = createdItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  await newOrder.update({ totalCost });

  res.status(201).json({
    orden: {
      id: newOrder.dailyOrderNumber,
      telefono: newOrder.clientId.startsWith("521")
        ? newOrder.clientId.slice(3)
        : newOrder.clientId,
      tipo: newOrder.orderType,
      estado: newOrder.status,
      informacion_entrega: newOrder.deliveryInfo,
      precio_total: newOrder.totalCost,
      fecha_creacion: newOrder.createdAt.toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      productos: await Promise.all(
        createdItems.map(async (item) => {
          const product = await Product.findByPk(item.productId);
          const productVariant = item.productVariantId
            ? await ProductVariant.findByPk(item.productVariantId)
            : null;
          const selectedModifiers = await SelectedModifier.findAll({
            where: { orderItemId: item.id },
            include: [{ model: Modifier }],
          });
          const selectedPizzaIngredients =
            await SelectedPizzaIngredient.findAll({
              where: { orderItemId: item.id },
              include: [{ model: PizzaIngredient }],
            });

          return {
            cantidad: item.quantity,
            nombre: productVariant ? productVariant.name : product.name,
            modificadores: selectedModifiers.map((sm) => ({
              nombre: sm.Modifier.name,
              precio: sm.Modifier.price,
            })),
            ingredientes_pizza: selectedPizzaIngredients.map((spi) => ({
              nombre:
                spi.action === "remove"
                  ? `Sin ${spi.PizzaIngredient.name}`
                  : spi.action === "add"
                  ? `Con ${spi.PizzaIngredient.name}`
                  : spi.PizzaIngredient.name,
              mitad: spi.half,
            })),
            comments: item.comments,
            precio: item.price,
          };
        })
      ),
      tiempoEstimado: newOrder.estimatedTime,
      horario_entrega_programado: newOrder.scheduledDeliveryTime,
    },
  });
}

async function modifyOrder(req, res) {
  const { orderId, orderType, orderItems, deliveryInfo, clientId } = req.body;

  // Buscar la orden por orderId
  const order = await Order.findOne({
    where: {
      id: orderId,
    },
  });

  if (order.status !== "created") {
    return res.status(400).json({
      error: 'La orden no se puede modificar porque su estado no es "creado".',
    });
  }

  const estaAbierto = await verificarHorarioAtencion();
  if (!estaAbierto) {
    return res.status(400).json({
      error:
        "Lo sentimos, solo se pueden modificar pedidos cuando el restaurante está abierto.",
    });
  }

  if (!["delivery", "pickup"].includes(orderType)) {
    return res.status(400).json({
      error: 'Tipo de orden inválido. Debe ser "delivery" o "pickup".',
    });
  }

  if (!deliveryInfo) {
    return res.status(400).json({
      error: "Se requiere información de entrega para órdenes de delivery.",
    });
  }

  // Validar que los items existan y sean un array
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return res
      .status(400)
      .json({ error: "Se requiere al menos un item para la orden." });
  }

  // Actualizar la orden
  await order.update({
    orderType,
    deliveryInfo: deliveryInfo,
  });

  // Eliminar items existentes y sus relaciones
  await OrderItem.destroy({ where: { orderId: order.id } });

  // Crear nuevos items
  const updatedItems = await Promise.all(
    orderItems.map(async (item) => {
      const product = await Product.findByPk(item.productId);
      if (!product) {
        throw new Error(`Producto no encontrado: ${item.productId}`);
      }
      let itemPrice = product.price || 0;

      if (item.productVariantId) {
        const productVariant = await ProductVariant.findByPk(
          item.productVariantId
        );
        if (!productVariant) {
          throw new Error(
            `Variante de producto no encontrada: ${item.productVariantId}`
          );
        }
        itemPrice = productVariant.price || 0;
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
          if (ingredient.half === "full") {
            totalIngredientValue += pizzaIngredient.ingredientValue;
          } else {
            halfIngredientValue[ingredient.half] +=
              pizzaIngredient.ingredientValue;
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

      // Sumar precios de modificadores
      if (item.selectedModifiers) {
        const modifierPrices = await Promise.all(
          item.selectedModifiers.map(async (modifier) => {
            const mod = await Modifier.findByPk(modifier.modifierId);
            return mod.price;
          })
        );
        itemPrice += modifierPrices.reduce((sum, price) => sum + price, 0);
      }

      const orderItem = await OrderItem.create({
        quantity: item.quantity,
        price: itemPrice,
        comments: item.comments,
        orderId: order.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
      });

      if (item.selectedModifiers) {
        await Promise.all(
          item.selectedModifiers.map((modifier) =>
            SelectedModifier.create({
              orderItemId: orderItem.id,
              modifierId: modifier.modifierId,
            })
          )
        );
      }

      if (item.selectedPizzaIngredients) {
        await Promise.all(
          item.selectedPizzaIngredients.map((ingredient) =>
            SelectedPizzaIngredient.create({
              orderItemId: orderItem.id,
              pizzaIngredientId: ingredient.pizzaIngredientId,
              half: ingredient.half,
            })
          )
        );
      }

      return orderItem;
    })
  );

  const totalCost = updatedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  await order.update({ totalCost });

  // Actualizar cliente si es necesario
  if (clientId) {
    const updateData = {};
    updateData.deliveryInfo = deliveryInfo;

    try {
      let customer = await Customer.findByPk(clientId);
      if (customer) {
        await customer.update(updateData);
      } else {
        customer = await Customer.create({
          clientId: clientId,
          ...updateData,
        });
      }
    } catch (error) {
      console.error("Error al actualizar el cliente:", error);
    }
  }

  res.status(200).json({
    mensaje: "Orden modificada exitosamente",
    orden: {
      id: order.dailyOrderNumber,
      telefono: newOrder.clientId.startsWith("521")
        ? newOrder.clientId.slice(3)
        : newOrder.clientId,
      tipo: order.orderType,
      estado: order.status,
      informacion_entrega: order.deliveryInfo,
      precio_total: order.totalCost,
      productos: await Promise.all(
        updatedItems.map(async (item) => {
          const product = await Product.findByPk(item.productId);
          const productVariant = item.productVariantId
            ? await ProductVariant.findByPk(item.productVariantId)
            : null;
          const selectedModifiers = await SelectedModifier.findAll({
            where: { orderItemId: item.id },
            include: [{ model: Modifier }],
          });
          const selectedPizzaIngredients =
            await SelectedPizzaIngredient.findAll({
              where: { orderItemId: item.id },
              include: [{ model: PizzaIngredient }],
            });

          return {
            cantidad: item.quantity,
            nombre: productVariant ? productVariant.name : product.name,
            modificadores: selectedModifiers.map((sm) => ({
              nombre: sm.Modifier.name,
              precio: sm.Modifier.price,
            })),
            ingredientes_pizza: selectedPizzaIngredients.map((spi) => ({
              nombre: spi.PizzaIngredient.name,
              mitad: spi.half,
            })),
            comments: item.comments,
            precio: item.price,
          };
        })
      ),
      tiempoEstimado: order.estimatedTime,
    },
  });
}

async function selectProducts(req, res) {
  const { orderItems, clientId, orderType, deliveryInfo } = req.body;

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return res
      .status(400)
      .json({ error: "Se requiere un array de orderItems" });
  }

  let totalCost = 0;
  try {
    const calculatedItems = await Promise.all(
      orderItems.map(async (item) => {
        try {
          let product, productVariant;
          let itemPrice, productName, productId, productVariantId;

          // Intentar encontrar primero como producto
          product = await Product.findByPk(item.productId);

          if (!product) {
            // Si no se encuentra como producto, buscar como variante
            productVariant = await ProductVariant.findByPk(item.productId);
            if (!productVariant) {
              throw new Error(
                `Producto o variante no encontrado en el menú: ${item.productId}`
              );
            }
            // Si es una variante, obtener el producto asociado
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

          // Verificar si el producto es una pizza y si se seleccionó al menos un ingrediente
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

              // if (modifierType.required && selectedModifiers.length === 0) {
              //   throw new Error(
              //     `El modificador "${modifierType.name}" es requerido para ${productName}`
              //   );
              // }

              // if (
              //   !modifierType.acceptsMultiple &&
              //   selectedModifiers.length > 1
              // ) {
              //   throw new Error(
              //     `El modificador "${modifierType.name}" no acepta múltiples selecciones para ${productName}`
              //   );
              // }

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
        } catch (error) {
          throw new Error(`Error al procesar el item: ${error.message}`);
        }
      })
    );

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
    messageContent += "\n";
    relevantMessageContent += "\n";

    calculatedItems.forEach((item) => {
      const itemName = item.nombre_producto;
      messageContent += `- *${item.quantity}x ${itemName}*: $${item.precio_total_orderItem}\n`;
      relevantMessageContent += `- *${item.quantity}x ${itemName}*\n`;

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

    const buttons = [
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
    ];

    const messageId = await sendWhatsAppMessage(
      clientId,
      messageContent,
      buttons
    );

    if (!messageId) {
      throw new Error("No se pudo enviar el mensaje de WhatsApp");
    }

    const preOrder = await PreOrder.create({
      orderItems,
      orderType,
      deliveryInfo,
      messageId,
    });
    console.log("Preorden guardada exitosamente");

    return res.status(200).json({
      mensaje: relevantMessageContent,
      preOrderId: preOrder.id,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function sendWhatsAppMessage(phoneNumber, message, buttons = null) {
  try {
    let payload = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: buttons ? "interactive" : "text",
      text: buttons ? undefined : { body: message },
      interactive: buttons
        ? {
            type: "button",
            body: { text: message },
            action: { buttons: buttons },
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

    // Devolver el ID del mensaje enviado
    return response.data.messages[0].id;
  } catch (error) {
    console.error("Error al enviar mensaje de WhatsApp:", error);
    return null;
  }
}
