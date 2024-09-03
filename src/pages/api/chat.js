const OpenAI = require("openai");
const axios = require("axios");
const {
  Order,
  Product,
  ProductVariant,
  PizzaIngredient,
  ModifierType,
  Modifier,
  Availability,
} = require("../../models");
const menu = require("../../data/menu");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function modifyOrder(toolCall, clientId) {
  const {
    dailyOrderNumber,
    orderType,
    orderItems,
    deliveryAddress,
    pickupName,
  } = JSON.parse(toolCall.function.arguments);

  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/api/create_order`,
      {
        action: "modify",
        dailyOrderNumber,
        orderType,
        orderItems,
        deliveryAddress,
        customerName: pickupName,
        clientId,
      }
    );

    const orderResult = response.data;
    console.log("Order modification result:", orderResult);

    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify(orderResult),
    };
  } catch (error) {
    console.error(
      "Error modifying order:",
      error.response ? error.response.data : error.message
    );
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({
        error: error.response
          ? error.response.data.error
          : "Failed to modify order",
        details: error.message,
      }),
    };
  }
}

async function cancelOrder(toolCall, clientId) {
  const { daily_order_number } = JSON.parse(toolCall.function.arguments);

  if (!daily_order_number) {
    console.error("Número de orden no proporcionado");
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({ error: "Número de orden no proporcionado" }),
    };
  }

  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/api/create_order`,
      {
        action: "cancel", // Añadimos la acción
        daily_order_number,
        client_id: clientId,
      }
    );

    const orderResult = response.data;
    console.log("Resultado de la cancelación de la orden:", orderResult);

    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify(orderResult),
    };
  } catch (error) {
    console.error(
      "Error al cancelar la orden:",
      error.response ? error.response.data : error.message
    );
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({
        error: error.response
          ? error.response.data.error
          : "No se pudo cancelar la orden",
        details: error.message,
      }),
    };
  }
}

async function getOrderDetails(dailyOrderNumber, clientId) {
  try {
    const mexicoTime = new Date().toLocaleString("en-US", {
      timeZone: "America/Mexico_City",
    });
    const today = new Date(mexicoTime).toISOString().split("T")[0];

    const order = await Order.findOne({
      where: {
        dailyOrderNumber: dailyOrderNumber,
        clientId: clientId,
        orderDate: today,
      },
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            { model: Product },
            { model: ProductVariant },
            {
              model: SelectedModifier,
              include: [{ model: Modifier }],
            },
            {
              model: SelectedPizzaIngredient,
              include: [{ model: PizzaIngredient }],
            },
          ],
        },
      ],
    });

    if (!order) {
      return {
        error:
          "Orden no encontrada o no asociada al cliente actual para el día de hoy",
      };
    }

    return {
      mensaje: "Detalles de la orden obtenidos exitosamente",
      orden: {
        Id: order.dailyOrderNumber,
        tipo: order.orderType,
        estado: order.status,
        telefono: order.phoneNumber,
        direccion_entrega: order.deliveryAddress,
        nombre_recogida: order.customerName,
        precio_total: order.totalCost,
        fecha_creacion: order.createdAt.toLocaleString("es-MX", {
          timeZone: "America/Mexico_City",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        productos: order.orderItems.map((item) => ({
          cantidad: item.quantity,
          nombre: item.ProductVariant
            ? item.ProductVariant.name
            : item.Product.name,
          modificadores: item.SelectedModifiers.map((sm) => ({
            nombre: sm.Modifier.name,
            precio: sm.Modifier.price,
          })),
          ingredientes_pizza: item.SelectedPizzaIngredients.map((spi) => ({
            nombre: spi.PizzaIngredient.name,
            mitad: spi.half,
          })),
          comments: item.comments,
          precio: item.price,
        })),
        tiempoEstimado: order.estimatedTime,
        horario_entrega_programado: order.scheduledDeliveryTime,
      },
    };
  } catch (error) {
    console.error("Error al obtener los detalles de la orden:", error);
    return { error: "Error al obtener los detalles de la orden" };
  }
}

async function getMenuAvailability() {
  try {
    // Verificar si los modelos necesarios están definidos
    if (
      !Product ||
      !ProductVariant ||
      !PizzaIngredient ||
      !ModifierType ||
      !Modifier ||
      !Availability
    ) {
      console.error("Uno o más modelos no están definidos");
      return { error: "Error en la configuración de los modelos" };
    }

    const products = await Product.findAll({
      include: [
        {
          model: ProductVariant,
          as: "productVariants",
          include: [{ model: Availability }],
        },
        {
          model: PizzaIngredient,
          as: "pizzaIngredients",
          include: [{ model: Availability }],
        },
        {
          model: ModifierType,
          as: "modifierTypes",
          include: [
            {
              model: Modifier,
              as: "modifiers",
              include: [{ model: Availability }],
            },
          ],
          include: [{ model: Availability }],
        },
        { model: Availability },
      ],
    });

    if (!products || products.length === 0) {
      console.error("No se encontraron productos");
      return { error: "No se encontraron productos en la base de datos" };
    }

    const menuDisponible = {
      entradas: [],
      comida: [],
      bebidas: [],
      cocteleria: [],
    };

    products.forEach((product) => {
      const productData = {
        id: product.id,
        name: product.name,
        disponible: product.Availability?.available || false,
      };

      if (product.ingredients) {
        productData.ingredients = product.ingredients;
      }

      // Añadir productVariants
      const productVariants = Array.isArray(product.productVariants)
        ? product.productVariants.map((variant) => {
            const variantData = {
              id: variant.id,
              name: variant.name,
              disponible: variant.Availability?.available || false,
            };
            if (variant.ingredients) {
              variantData.ingredients = variant.ingredients;
            }
            return variantData;
          })
        : [];
      if (productVariants.length > 0) {
        productData.productVariants = productVariants;
      }

      // Añadir pizzaIngredients
      const pizzaIngredients = Array.isArray(product.pizzaIngredients)
        ? product.pizzaIngredients.map((ingredient) => {
            const ingredientData = {
              id: ingredient.id,
              name: ingredient.name,
              disponible: ingredient.Availability?.available || false,
            };
            if (ingredient.ingredients) {
              ingredientData.ingredients = ingredient.ingredients;
            }
            return ingredientData;
          })
        : [];
      if (pizzaIngredients.length > 0) {
        productData.pizzaIngredients = pizzaIngredients;
      }

      // Añadir modifierTypes solo si no está vacío
      const modifierTypes = Array.isArray(product.modifierTypes)
        ? product.modifierTypes.map((modifier) => {
            const modifierData = {
              id: modifier.id,
              name: modifier.name,
              disponible: modifier.Availability?.available || false,
            };
            const modifiers = Array.isArray(modifier.modifiers)
              ? modifier.modifiers.map((mod) => ({
                  id: mod.id,
                  name: mod.name,
                  disponible: mod.Availability?.available || false,
                }))
              : [];
            if (modifiers.length > 0) {
              modifierData.modifiers = modifiers;
            }
            return modifierData;
          })
        : [];
      if (modifierTypes.length > 0) {
        productData.modifierTypes = modifierTypes;
      }

      menuDisponible[product.category].push(productData);
    });

    // Eliminar categorías vacías
    Object.keys(menuDisponible).forEach((category) => {
      if (menuDisponible[category].length === 0) {
        delete menuDisponible[category];
      }
    });

    return { "Menu Disponible": menuDisponible };
  } catch (error) {
    console.error("Error al obtener la disponibilidad del menú:", error);
    return {
      error: "No se pudo obtener la disponibilidad del menú",
      detalles: error.message,
      stack: error.stack,
    };
  }
}

const MAX_RETRIES = 5;
const INITIAL_DELAY = 1000;
const MAX_DELAY = 32000;

async function waitForCompletion(threadId, runId, res) {
  let retries = 0;
  let delay = INITIAL_DELAY;

  while (retries < MAX_RETRIES) {
    console.log(`Intento ${retries + 1} de ${MAX_RETRIES}`);

    const run = await openai.beta.threads.runs.retrieve(threadId, runId);
    console.log(`Estado actual: ${run.status}`);

    if (run.status === "completed") {
      console.log("Solicitud completada con éxito");
      return run;
    } else if (run.status === "failed") {
      console.error("La solicitud falló:", run.last_error);
      throw new Error(run.last_error?.message || "Error desconocido");
    } else if (run.status === "requires_action") {
      console.log("Se requiere acción adicional");
      return run;
    }

    console.log(`Esperando ${delay}ms antes del próximo intento`);
    await new Promise((resolve) => setTimeout(resolve, delay));

    retries++;
    delay = Math.min(delay * 2, MAX_DELAY);
  }

  res
    .status(200)
    .send(
      "Se excedió el tiempo de espera, el servicio no está disponible en este momento."
    );
  return {
    status: "error",
    message: "Se excedió el número máximo de intentos",
  };
}

export async function handleChatRequest(req) {
  const { messages, conversationId } = req;

  try {
    // Obtener la disponibilidad del menú
    const menuAvailability = await getMenuAvailability();

    // Crear un nuevo mensaje con la disponibilidad del menú
    const menuAvailabilityMessage = {
      role: "assistant",
      content: JSON.stringify(menuAvailability),
    };

    // Añadir el mensaje de disponibilidad del menú al principio de los mensajes
    const updatedMessages = [menuAvailabilityMessage, ...messages];

    console.log("Updated messages:", updatedMessages);

    const thread = await openai.beta.threads.create({
      messages: updatedMessages,
    });

    let run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    let shouldDeleteConversation = false;

    while (true) {
      console.log(`Iniciando ciclo. Estado actual: ${run.status}`);

      if (run.status === "requires_action") {
        const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
        console.log("Tool calls:", toolCalls);

        for (const toolCall of toolCalls) {
          const clientId = conversationId;
          let result;

          switch (toolCall.function.name) {
            case "modify_order":
              result = await modifyOrder(toolCall, clientId);
              shouldDeleteConversation = true;
              return { text: result.output }; // Retorna directamente al cliente

            case "cancel_order":
              result = await cancelOrder(toolCall, clientId);
              shouldDeleteConversation = true;
              return { text: result.output }; // Retorna directamente al cliente

            case "get_order_details":
              const { daily_order_number } = JSON.parse(
                toolCall.function.arguments
              );
              const orderDetails = await getOrderDetails(
                daily_order_number,
                clientId
              );
              return { text: JSON.stringify(orderDetails) }; // Retorna directamente al cliente

            case "send_menu":
              return [
                { text: menu, isRelevant: false },
                {
                  text: "El menú ha sido enviado, si tienes alguna duda, no dudes en preguntar",
                  isRelevant: true,
                },
              ];
            case "select_products":
              result = await selectProducts(toolCall, clientId);
              if (result.output) {
                return { text: result.output };
              } else {
                break;
              }
            default:
              console.log(`Función desconocida: ${toolCall.function.name}`);
              return { error: "Función desconocida" };
          }
        }
      } else {
        try {
          run = await waitForCompletion(thread.id, run.id);
          if (run.status === "completed") break;
          if (run.status === "error") {
            return { error: run.message };
          }
        } catch (error) {
          console.error("Error durante la espera:", error);
          return { error: "Error durante la espera: " + error.message };
        }
      }
    }

    console.log(`Solicitud completada. Estado final: ${run.status}`);

    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const lastAssistantMessage = messages.data.find(
        (message) => message.role === "assistant"
      );
      if (lastAssistantMessage && lastAssistantMessage.content[0].text) {
        let text = lastAssistantMessage.content[0].text.value;
        console.log("Assistant response:", text);

        if (shouldDeleteConversation) {
          try {
            await Customer.update(
              { relevantChatHistory: null },
              { where: { clientId: conversationId } }
            );
            console.log(
              `Historial de chat relevante borrado para el cliente: ${conversationId}`
            );
          } catch (error) {
            console.error(
              `Error al borrar la conversación o el historial de chat para el cliente ${conversationId}:`,
              error
            );
          }
        }
        return { text };
      } else {
        console.log("Run failed with status:", run.status);
        return { error: "Failed to complete the conversation" };
      }
    } else {
      console.log("Run not completed. Final status:", run.status);
      return { error: "Run not completed. Final status: " + run.status };
    }
  } catch (error) {
    console.error("Error general:", error);
    return { error: "Error al procesar la solicitud: " + error.message };
  }
}

async function selectProducts(toolCall, clientId) {
  const { orderItems } = JSON.parse(toolCall.function.arguments);

  try {
    await axios.post(`${process.env.BASE_URL}/api/create_order`, {
      action: "selectProducts",
      orderItems: orderItems,
      clientId: clientId,
    });
  } catch (error) {
    console.error("Error al seleccionar los productos:", error);

    if (error.response && error.response.data && error.response.data.error) {
      return { output: error.response.data.error };
    } else {
      return {
        output:
          "Error al seleccionar los productos. Por favor, inténtalo de nuevo.",
      };
    }
  }
}
