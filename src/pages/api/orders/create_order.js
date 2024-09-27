import dotenv from "dotenv";
dotenv.config();
const {
  Order,
  Customer,
  OrderItem,
  Product,
  ProductVariant,
  PizzaIngredient,
  Modifier,
  SelectedModifier,
  SelectedPizzaIngredient,
  RestaurantConfig,
} = require("../../../models");
const { verificarHorarioAtencion } = require("../../../utils/timeUtils");
const { getNextDailyOrderNumber } = require("../../../utils/orderUtils");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    orderType,
    orderItems,
    deliveryInfo,
    clientId,
    scheduledDeliveryTime,
  } = req.body;

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
