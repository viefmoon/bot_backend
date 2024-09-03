const { connectDB } = require("../../lib/db");
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
        case "cancel":
          return await cancelOrder(req, res);
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
  const { orderType, orderItems, deliveryAddress, customerName, clientId } =
    req.body;

  // Verificar si el restaurante está aceptando pedidos y obtener la configuración
  const config = await RestaurantConfig.findOne();
  if (!config || !config.acceptingOrders) {
    return res.status(400).json({
      error:
        "Lo sentimos, el restaurante no está aceptando pedidos en este momento debido a saturación, puedes intentar mas tarde o llamar al restaurante.",
    });
  }

  const estaAbierto = await verificarHorarioAtencion();
  if (!estaAbierto) {
    return res.status(400).json({
      error:
        "Lo sentimos, solo podre procesar tu pedido cuando el restaurante este abierto.",
    });
  }

  if (!["delivery", "pickup"].includes(orderType)) {
    return res.status(400).json({
      error: 'Tipo de orden inválido. Debe ser "delivery" o "pickup".',
    });
  }

  if (orderType === "delivery" && !deliveryAddress) {
    return res.status(400).json({
      error: "Se requiere dirección de entrega para órdenes de delivery.",
    });
  }

  if (orderType === "pickup" && !customerName) {
    return res.status(400).json({
      error: "Se requiere nombre de quien recoge para órdenes de pickup.",
    });
  }

  if (clientId) {
    const updateData = {};
    if (orderType === "delivery") {
      updateData.lastDeliveryAddress = deliveryAddress;
    } else if (orderType === "pickup") {
      updateData.lastPickupName = customerName;
    }

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
    deliveryAddress: orderType === "delivery" ? deliveryAddress : null,
    customerName: orderType === "pickup" ? customerName : null,
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
          if (ingredient.half === "none") {
            totalIngredientValue += pizzaIngredient.ingredientValue;
          } else {
            halfIngredientValue[ingredient.half] +=
              pizzaIngredient.ingredientValue;
          }
        }

        // Calcular precio adicional para pizza completa
        if (totalIngredientValue > 4) {
          itemPrice += (totalIngredientValue - 4) * 10;
        }

        // Calcular precio adicional para mitades
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
    mensaje: "Orden creada exitosamente",
    orden: {
      Id: newOrder.dailyOrderNumber,
      tipo: newOrder.orderType,
      estado: newOrder.status,
      direccion_entrega: newOrder.deliveryAddress,
      nombre_recogida: newOrder.customerName,
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
              nombre: spi.PizzaIngredient.name,
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
  const {
    dailyOrderNumber,
    orderType,
    orderItems,
    deliveryAddress,
    customerName,
    clientId,
  } = req.body;

  // Obtener la fecha actual en la zona horaria de México
  const mexicoTime = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  });
  const today = new Date(mexicoTime).toISOString().split("T")[0];

  // Buscar la orden por dailyOrderNumber y fecha actual
  const order = await Order.findOne({
    where: {
      dailyOrderNumber: dailyOrderNumber,
      orderDate: today,
    },
  });

  if (!order) {
    return res
      .status(400)
      .json({ error: "La orden no existe o no es del día actual." });
  }

  if (order.clientId !== clientId) {
    return res
      .status(400)
      .json({ error: "La orden no corresponde al cliente proporcionado." });
  }

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

  if (orderType === "delivery" && !deliveryAddress) {
    return res.status(400).json({
      error: "Se requiere dirección de entrega para órdenes de delivery.",
    });
  }

  if (orderType === "pickup" && !customerName) {
    return res.status(400).json({
      error: "Se requiere nombre de quien recoge para órdenes de pickup.",
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
    deliveryAddress: orderType === "delivery" ? deliveryAddress : null,
    customerName: orderType === "pickup" ? customerName : null,
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
          if (ingredient.half === "none") {
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
    if (orderType === "delivery") {
      updateData.lastDeliveryAddress = deliveryAddress;
    } else if (orderType === "pickup") {
      updateData.lastPickupName = customerName;
    }

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
      tipo: order.orderType,
      estado: order.status,
      direccion_entrega: order.deliveryAddress,
      nombre_recogida: order.customerName,
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

async function cancelOrder(req, res) {
  const { dailyOrderNumber, clientId } = req.body;

  // Obtener la fecha actual en la zona horaria de México
  const mexicoTime = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  });
  const today = new Date(mexicoTime).toISOString().split("T")[0];

  // Buscar la orden por dailyOrderNumber y fecha actual
  const order = await Order.findOne({
    where: {
      dailyOrderNumber: dailyOrderNumber,
      orderDate: today,
    },
  });

  if (!order) {
    return res
      .status(400)
      .json({ error: "La orden no existe o no es del día actual." });
  }

  if (order.clientId !== clientId) {
    return res
      .status(400)
      .json({ error: "La orden no corresponde al cliente proporcionado." });
  }

  if (order.status !== "created") {
    return res.status(400).json({
      error: 'La orden no se puede cancelar porque su estado no es "creado".',
    });
  }

  await order.update({ status: "canceled" });

  res.status(200).json({
    mensaje: "Orden cancelada exitosamente",
    orden: {
      Id: order.dailyOrderNumber,
      estado: order.status,
    },
  });
}

async function selectProducts(req, res) {
  const { orderItems, clientId, orderType, deliveryAddress, customerName } =
    req.body;

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return res
      .status(400)
      .json({ error: "Se requiere un array de orderItems" });
  }

  let totalCost = 0;
  try {
    const customerResponse = await axios.get(
      `${process.env.BASE_URL}/api/get_customer_data`,
      { params: { clientId } }
    );
    const customerData = customerResponse.data;

    const calculatedItems = await Promise.all(
      orderItems.map(async (item) => {
        try {
          const product = await Product.findByPk(item.productId);
          if (!product) {
            throw new Error(
              `Producto no encontrado en el menu: ${item.productId}`
            );
          }
          let itemPrice = product.price || 0;
          let productName = product.name;
          let productVariantName = null;

          // Verificar si el producto tiene productVariants y si se seleccionó una productVariant
          const hasProductVariants =
            (await ProductVariant.count({ where: { productId: product.id } })) >
            0;
          if (hasProductVariants && !item.productVariantId) {
            throw new Error(
              `El producto "${productName}" requiere la selección de una productVariant`
            );
          }

          if (item.productVariantId) {
            const productVariant = await ProductVariant.findByPk(
              item.productVariantId
            );
            if (!productVariant) {
              throw new Error(
                `Variante de producto no encontrada en el menu: ${item.productVariantId}`
              );
            }
            itemPrice = productVariant.price;
            productVariantName = productVariant.name;
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
              if (ingredient.half === "none") {
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

          // Validar y calcular precio de modificadores
          if (item.selectedModifiers && item.selectedModifiers.length > 0) {
            const modifierTypes = await ModifierType.findAll({
              where: { productId: item.productId },
              include: [{ model: Modifier, as: "modifiers" }],
            });

            for (const modifierType of modifierTypes) {
              const selectedModifiers = item.selectedModifiers.filter((mod) =>
                mod.modifierId.startsWith(modifierType.id)
              );

              if (modifierType.required && selectedModifiers.length === 0) {
                throw new Error(
                  `El modificador "${modifierType.name}" es requerido para ${productName}`
                );
              }

              if (
                !modifierType.acceptsMultiple &&
                selectedModifiers.length > 1
              ) {
                throw new Error(
                  `El modificador "${modifierType.name}" no acepta múltiples selecciones para ${productName}`
                );
              }

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
                if (ingredient.half === "none") {
                  pizzaIngredientNames.full.push(pizzaIngredient.name);
                } else {
                  pizzaIngredientNames[ingredient.half].push(
                    pizzaIngredient.name
                  );
                }
              })
            );
          }

          return {
            ...item,
            precio_total_orderItem: totalItemPrice,
            nombre_producto: productName,
            nombre_variante: productVariantName,
            modificadores: modifierNames,
            ingredientes_pizza: pizzaIngredientNames,
          };
        } catch (error) {
          throw new Error(`Error al procesar el item: ${error.message}`);
        }
      })
    );

    let messageContent = "Aquí tienes el resumen de tu pedido\n\n";

    messageContent += "Telefono: " + customerData.phoneNumber + "\n";
    messageContent += `🏠 *Dirección de entrega*: ${
      customerData.lastDeliveryAddress || "No disponible"
    }\n`;
    messageContent += `👤 *Nombre de recolección*: ${
      customerData.lastPickupName || "No disponible"
    }\n`;
    messageContent += "\n";

    calculatedItems.forEach((item) => {
      const itemName = item.nombre_variante || item.nombre_producto;
      messageContent += `- *${item.quantity}x ${itemName}*: $${item.precio_total_orderItem}\n`;

      if (item.modificadores.length > 0) {
        messageContent += `  🔸 Modificadores: ${item.modificadores.join(
          ", "
        )}\n`;
      }

      if (
        item.ingredientes_pizza.full.length > 0 ||
        item.ingredientes_pizza.left.length > 0 ||
        item.ingredientes_pizza.right.length > 0
      ) {
        messageContent += "  🔸 Ingredientes de pizza: ";
        if (item.ingredientes_pizza.full.length > 0) {
          messageContent += `${item.ingredientes_pizza.full.join(", ")}`;
        }
        if (
          item.ingredientes_pizza.left.length > 0 ||
          item.ingredientes_pizza.right.length > 0
        ) {
          if (item.ingredientes_pizza.full.length > 0) messageContent += ", ";
          messageContent += `(${item.ingredientes_pizza.left.join(
            ", "
          )} / ${item.ingredientes_pizza.right.join(", ")})`;
        }
        messageContent += "\n";
      }

      if (item.comments) {
        messageContent += `  💬 Comentarios: ${item.comments}\n`;
      }
    });
    messageContent += `\n💰 *Total: $${totalCost}*`;

    const messageId = await sendWhatsAppMessage(clientId, messageContent);

    if (!messageId) {
      throw new Error("No se pudo enviar el mensaje de WhatsApp");
    }

    const preOrder = await PreOrder.create({
      orderItems,
      orderType,
      deliveryAddress,
      customerName,
      messageId,
    });
    console.log("Preorden guardada exitosamente");

    return res.status(200).json({
      mensaje: "Preorden guardada exitosamente",
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
      `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
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
