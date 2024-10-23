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

export class PreOrderService {
  async selectProducts(orderData: {
    orderItems: any[];
    clientId: string;
    orderType: string;
    scheduledDeliveryTime?: string | Date;
  }) {
    const { orderItems, clientId, orderType, scheduledDeliveryTime } =
      orderData;
    let totalCost = 0;
    let fullScheduledDeliveryTime: Date | null = null;

    const config = await RestaurantConfig.findOne();

    // Validar tiempo de entrega programado
    if (scheduledDeliveryTime) {
      const now = new Date();

      if (typeof scheduledDeliveryTime === "string") {
        if (scheduledDeliveryTime.includes("T")) {
          // Formato completo
          fullScheduledDeliveryTime = new Date(scheduledDeliveryTime);
        } else {
          // Formato de solo horas
          // Obtener la fecha actual en la zona horaria de México
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Mexico_City",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });

          const parts = formatter.formatToParts(new Date());
          const year = parts.find((part) => part.type === "year")?.value;
          const month = parts.find((part) => part.type === "month")?.value;
          const day = parts.find((part) => part.type === "day")?.value;

          if (!year || !month || !day) {
            throw new Error("Error al obtener la fecha actual de México.");
          }

          const [hours, minutes] = scheduledDeliveryTime.split(":").map(Number);

          // Crear una cadena de fecha y hora con la zona horaria de México
          const scheduledDateTimeString = `${year}-${month}-${day}T${hours
            .toString()
            .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00-06:00`; // Ajusta el offset según corresponda (-05:00 o -06:00)

          fullScheduledDeliveryTime = new Date(scheduledDateTimeString);
        }
      } else if (scheduledDeliveryTime instanceof Date) {
        // Es un objeto Date
        fullScheduledDeliveryTime = scheduledDeliveryTime;
      }

      // Convertir fullScheduledDeliveryTime a la zona horaria de México
      const mexicoTime = new Date(
        fullScheduledDeliveryTime.toLocaleString("en-US", {
          timeZone: "America/Mexico_City",
        })
      );

      // Obtener día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
      const dayOfWeek = mexicoTime.getDay();

      // Obtener hora y minuto del tiempo programado en hora de México
      const scheduledHour = mexicoTime.getHours();
      const scheduledMinute = mexicoTime.getMinutes();

      // Definir horarios de apertura y cierre
      let openingTime, closingTime;
      if (dayOfWeek === 0) {
        // Domingo
        openingTime = process.env.OPENING_HOURS_SUN;
        closingTime = process.env.CLOSING_HOURS_SUN;
      } else {
        // Martes a Sábado
        openingTime = process.env.OPENING_HOURS_TUES_SAT;
        closingTime = process.env.CLOSING_HOURS_TUES_SAT;
      }

      // Convertir horarios a minutos desde medianoche
      const [openingHour, openingMinute] = openingTime.split(":").map(Number);
      const [closingHour, closingMinute] = closingTime.split(":").map(Number);
      const openingMinutes = openingHour * 60 + openingMinute;
      const closingMinutes = closingHour * 60 + closingMinute;

      // Aplicar períodos de gracia
      const openingGracePeriod = parseInt(
        process.env.OPENING_GRACE_PERIOD_MINUTES
      );
      const closingGracePeriod = parseInt(
        process.env.CLOSING_GRACE_PERIOD_MINUTES
      );
      const adjustedOpeningMinutes = openingMinutes - openingGracePeriod;
      const adjustedClosingMinutes = closingMinutes + closingGracePeriod;

      // Convertir tiempo programado a minutos desde medianoche (usando hora de México)
      const scheduledMinutes = scheduledHour * 60 + scheduledMinute;

      // Verificar si el tiempo programado está dentro del horario laborable ajustado
      const adjustedOpeningTime = new Date(mexicoTime);
      adjustedOpeningTime.setHours(
        openingHour,
        openingMinute - openingGracePeriod
      );

      const adjustedClosingTime = new Date(mexicoTime);
      adjustedClosingTime.setHours(
        closingHour,
        closingMinute + closingGracePeriod
      );

      const adjustedOpeningTimeFormatted =
        adjustedOpeningTime.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      const adjustedClosingTimeFormatted =
        adjustedClosingTime.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

      if (
        scheduledMinutes < adjustedOpeningMinutes ||
        scheduledMinutes > adjustedClosingMinutes
      ) {
        throw new Error(
          `⚠️ El tiempo programado está fuera del horario laborable. Por favor, programa tu pedido para después de las ${adjustedOpeningTimeFormatted}⏰🔓 o antes de las ${adjustedClosingTimeFormatted} ⏰🔒.`
        );
      }

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

        console.log("item", JSON.stringify(item, null, 2));

        if (item.productId) {
          // Buscar el producto
          product = await Product.findByPk(item.productId);

          if (!product) {
            throw new Error(
              `Producto no encontrado en el menú: Producto ${item.productId}`
            );
          }

          // Asignar valores directamente del producto si no hay variante
          itemPrice = product.price || 0;
          productName = product.name;

          // Si existe productVariant y productVariantId, buscar la variante
          if (item.productVariant && item.productVariant.productVariantId) {
            productVariant = await ProductVariant.findByPk(
              item.productVariant.productVariantId
            );

            if (productVariant) {
              itemPrice = productVariant.price || itemPrice;
              productName = productVariant.name || productName;
              item.productVariantId = productVariant.id;
            }
          }
        } else {
          throw new Error(
            `Producto no encontrado en el menú: ${item.productId}`
          );
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
          // Inicializar los valores de ingredientes por mitad
          let halfIngredientValue = { left: 0, right: 0 };

          for (const ingredient of item.selectedPizzaIngredients) {
            const pizzaIngredient = await PizzaIngredient.findByPk(
              ingredient.pizzaIngredientId
            );
            if (!pizzaIngredient) {
              throw new Error(
                `Ingrediente de pizza no encontrado en el menú: ${ingredient.pizzaIngredientId}`
              );
            }
            const ingredientValue =
              ingredient.action === "add"
                ? pizzaIngredient.ingredientValue
                : -pizzaIngredient.ingredientValue;

            if (ingredient.half === "full") {
              // Los ingredientes "full" contribuyen completamente a ambas mitades
              halfIngredientValue.left += ingredientValue;
              halfIngredientValue.right += ingredientValue;
            } else if (
              ingredient.half === "left" ||
              ingredient.half === "right"
            ) {
              halfIngredientValue[ingredient.half] += ingredientValue;
            } else {
              throw new Error(`Valor de mitad inválido: ${ingredient.half}`);
            }
          }

          // Ahora, calcular el precio adicional por cada mitad
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
                  ? `${pizzaIngredient.name}`
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

    let scheduledTime = null;
    if (fullScheduledDeliveryTime) {
      scheduledTime = fullScheduledDeliveryTime.toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    }

    const estimatedTime =
      orderType === "pickup"
        ? `${config.estimatedPickupTime} minutos`
        : `${config.estimatedDeliveryTime} minutos`;

    let messageContent =
      "Informame si tienes algun cambio o deseas agregar algun producto mas.\n\n";
    let relevantMessageContent =
      "Resumen del pedido hasta este momento, informame si tienes algun cambio o deseas agregar algun producto mas.\n\n";

    let deliveryInfo;
    if (orderType === "delivery") {
      deliveryInfo =
        orderDeliveryInfo.streetAddress +
        (orderDeliveryInfo.additionalDetails
          ? `, ${orderDeliveryInfo.additionalDetails}`
          : "");
    } else if (orderType === "pickup") {
      deliveryInfo = orderDeliveryInfo.pickupName;
    }

    messageContent += `${orderType === "delivery" ? "🚚" : "🏬"} *${
      orderType === "delivery" ? "Domicilio" : "Nombre recolección"
    }*: ${deliveryInfo || "No disponible"}\n`;
    relevantMessageContent += `${
      orderType === "delivery" ? "Domicilio" : "Nombre recolección"
    }: ${deliveryInfo || "No disponible"}\n`;
    if (scheduledTime) {
      messageContent += `⏱️ *Hora programada*: ${scheduledTime}\n`;
    } else {
      messageContent += `⏱️ *Tiempo estimado*: ${estimatedTime}\n`;
    }

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

        let leftIngredients = [...item.ingredientes_pizza.left];
        let rightIngredients = [...item.ingredientes_pizza.right];

        // Agregar ingredientes "full" a ambas mitades
        item.ingredientes_pizza.full.forEach((ingredient) => {
          leftIngredients.push(ingredient);
          rightIngredients.push(ingredient);
        });

        // Formatear los ingredientes
        const formatIngredients = (ingredients) => ingredients.join(", ");

        if (
          item.ingredientes_pizza.full.length > 0 &&
          leftIngredients.length === rightIngredients.length
        ) {
          // Si solo hay ingredientes "full", no separamos por mitades
          messageContent += `    ${formatIngredients(leftIngredients)}\n`;
          relevantMessageContent += `    ${formatIngredients(
            leftIngredients
          )}\n`;
        } else {
          // Si hay ingredientes en mitades o una combinación, usamos el formato con separación
          messageContent += `    (${formatIngredients(
            leftIngredients
          )} / ${formatIngredients(rightIngredients)})\n`;
          relevantMessageContent += `    (${formatIngredients(
            leftIngredients
          )} / ${formatIngredients(rightIngredients)})\n`;
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

    // Borrar todas las preórdenes asociadas al cliente
    await PreOrder.destroy({ where: { clientId } });

    const preOrder = await PreOrder.create({
      orderItems,
      orderType: orderType as "delivery" | "pickup",
      scheduledDeliveryTime: fullScheduledDeliveryTime,
      clientId,
    });

    // Actualizar información de entrega
    await orderDeliveryInfo.update({
      preOrderId: preOrder.id,
    });

    // En lugar de enviar el mensaje interactivo, lo retornamos
    return {
      status: 200,
      json: {
        sendToWhatsApp: false,
        text: relevantMessageContent,
        preOrderId: preOrder.id,
        isRelevant: true,
        interactiveMessage: {
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
                  id: "modify_delivery",
                  title: "Modificar Entrega",
                },
              },
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
        },
      },
    };
  }
  catch(error) {
    return {
      status: 400,
      json: {
        sendToWhatsApp: true,
        text: error.message,
      },
    };
  }

  async getPreOrderById(preOrderId: string): Promise<PreOrder | null> {
    return await PreOrder.findByPk(preOrderId);
  }
}
