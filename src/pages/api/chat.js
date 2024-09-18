const OpenAI = require("openai");
const axios = require("axios");
const {
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
const { partial_ratio } = require("fuzzball");
const { preprocessMessage } = require("../../utils/preprocessMessage");

async function modifyOrder(toolCall, clientId) {
  const { dailyOrderNumber, orderType, orderItems, deliveryInfo } = JSON.parse(
    toolCall.function.arguments
  );

  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/api/create_order`,
      {
        action: "modify",
        dailyOrderNumber,
        orderType,
        orderItems,
        deliveryInfo,
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
            { model: Availability },
            {
              model: Modifier,
              as: "modifiers",
              include: [{ model: Availability }],
            },
          ],
        },
        { model: Availability },
      ],
    });

    if (!products || products.length === 0) {
      console.error("No se encontraron productos");
      return { error: "No se encontraron productos en la base de datos" };
    }

    const menuSimplificado = products.map((producto) => {
      const productoInfo = {
        productId: producto.id,
        name: producto.name,
        //active: producto.Availability?.available || false,
      };

      // Agregar variantes
      if (producto.productVariants?.length > 0) {
        productoInfo.variantes = producto.productVariants.map((v) => ({
          variantId: v.id,
          name: v.name,
          //active: v.Availability?.available || false,
        }));
      }

      // Agregar modificadores
      if (producto.modifierTypes?.length > 0) {
        productoInfo.modificadores = producto.modifierTypes.flatMap(
          (mt) =>
            mt.modifiers?.map((m) => ({
              modifierId: m.id,
              name: m.name,
              //active: m.Availability?.available || false,
            })) || []
        );
      }

      // Agregar ingredientes de pizza
      if (producto.pizzaIngredients?.length > 0) {
        productoInfo.ingredientesPizza = producto.pizzaIngredients.map((i) => ({
          pizzaIngredientId: i.id,
          name: i.name,
          //active: i.Availability?.available || false,
        }));
      }

      return productoInfo;
    });

    return {
      "Menu Disponible": menuSimplificado,
    };
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

    try {
      const run = await openai.chat.completions.retrieve(threadId, runId);
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
    } catch (error) {
      if (error.status === 404) {
        console.error("Hilo o ejecución no encontrada:", error.message);
        throw new Error("Hilo o ejecución no encontrada");
      }
      throw error;
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

function extractMentionedProducts(message, menu) {
  const mentionedProducts = [];
  const words = message.toLowerCase().split(/\s+/);

  for (const product of menu["Menu Disponible"]) {
    const productName = product.name.toLowerCase();
    let isProductMentioned = words.some(
      (word) => word.length > 3 && partial_ratio(productName, word) > 80
    );

    // Buscar en las variantes
    const variantsMentioned = product.variantes?.some((variant) =>
      words.some(
        (word) =>
          word.length > 3 &&
          partial_ratio(variant.name.toLowerCase(), word) > 80
      )
    );

    if (isProductMentioned || variantsMentioned) {
      const mentionedProduct = {
        productId: product.productId,
        name: product.name,
      };

      // Agregar variantes solo si existen
      if (product.variantes && product.variantes.length > 0) {
        mentionedProduct.productVariants = product.variantes;
      }

      // Filtrar modificadores mencionados
      if (product.modificadores) {
        const mentionedModifiers = product.modificadores.filter((modifier) =>
          words.some(
            (word) =>
              word.length > 3 &&
              partial_ratio(modifier.name.toLowerCase(), word) > 80
          )
        );

        if (mentionedModifiers.length > 0) {
          mentionedProduct.modifierTypes = [{ modifiers: mentionedModifiers }];
        }
      }

      // Filtrar ingredientes de pizza mencionados
      if (product.ingredientesPizza) {
        const mentionedIngredients = product.ingredientesPizza.filter(
          (ingredient) =>
            words.some(
              (word) =>
                word.length > 3 &&
                partial_ratio(ingredient.name.toLowerCase(), word) > 80
            )
        );

        if (mentionedIngredients.length > 0) {
          mentionedProduct.pizzaIngredients = mentionedIngredients;
        }
      }

      console.log("Producto mencionado:", mentionedProduct);
      mentionedProducts.push(mentionedProduct);
    }
  }
  return mentionedProducts;
}

async function getRelevantMenuItems(relevantMessages) {
  const fullMenu = await getMenuAvailability();
  let mentionedProducts = [];

  for (const message of relevantMessages) {
    if (message.role === "user") {
      const productsInMessage = extractMentionedProducts(
        message.content,
        fullMenu
      );
      mentionedProducts = [...mentionedProducts, ...productsInMessage];
    }
  }

  // Eliminar duplicados
  mentionedProducts = Array.from(new Set(mentionedProducts));

  const relevantMenu = {
    "Menú disponible para buscar los productId, variantId, pizzaIngredientId y modifierId de los productos solicitados por el cliente. Solo están disponibles estos identificadores, Asegurate de nunca usar VariantId en el lugar de ProductdId y viceversa. Si no se encuentra el producto que solicitó el cliente, se le informará al cliente en lugar de ejecutar select_products":
      mentionedProducts,
  };
  return relevantMenu;
}

const tools = [
  {
    type: "function",
    function: {
      name: "select_products",
      description:
        "Genera un resumen de los productos seleccionados y crea una preorden.",
      parameters: {
        type: "object",
        properties: {
          orderItems: {
            type: "array",
            description: "Lista de ítems pedidos.",
            items: {
              type: "object",
              properties: {
                productId: {
                  type: "string",
                  description: "El identificador único del producto.",
                },
                quantity: {
                  type: "integer",
                  description: "La cantidad del producto pedido.",
                },
                variantId: {
                  type: "string",
                  description:
                    "El identificador único de la variante del producto, si aplica.",
                },
                modifierId: {
                  type: "string",
                  description:
                    "El identificador único del modificador del producto, si aplica.",
                },
                pizzaIngredientId: {
                  type: "string",
                  description:
                    "El identificador único del ingrediente de pizza, si aplica.",
                },
              },
              required: ["productId", "quantity"],
              additionalProperties: false,
            },
          },
          orderType: {
            type: "string",
            enum: ["delivery", "pickup"],
            description: "Entrega a domicilio o recoleccion en restuarante.",
          },
          deliveryInfo: {
            type: "string",
            description:
              "Dirección de entrega para pedidos a domicilio o nombre de cliente para pedidos de recoleccion en el restautante.",
          },
        },
        required: ["orderItems", "orderType", "deliveryInfo"],
        additionalProperties: false,
      },
    },
  },
];

export async function handleChatRequest(req) {
  const { relevantMessages, conversationId } = req;
  try {
    const relevantMenuItems = await getRelevantMenuItems(relevantMessages);

    const systemMessageContent = {
      assistant_config: {
        description:
          "Eres un asistente virtual del Restaurante La Leña, especializado en la seleccion de productos. Utilizas emojis en tus interacciones para crear una experiencia amigable y , mantiene las interacciones rapidas y eficaces.",
        instructions: [
          {
            title: "Seleccion de productos",
            details: [
              "Es OBLIGATORIO ejecutar la función `select_products` cada vez que se elija un nuevo producto o varios, se modifique un producto existente o se elimine un producto.",
              "Llama a la función `select_products` con los siguientes parámetros:",
              " - orderItems: Lista de ítems ordenes con la siguiente estructura para cada ítem:",
              "   - productId: Obligatorio para todos los ordeitems.",
              "   - productVariantId: Obligatorio si el producto tiene variantes.",
              "   - quantity: Obligatorio, indica la cantidad del producto.",
              "   - selectedModifiers: Modificadores seleccionados para el producto.",
              "   - selectedPizzaIngredients: Obligatorio para pizzas contempla que existen variantes de pizza variantes de relleno, debes incluir al menos un ingrediente. Es un array de ingredientes con la siguiente estructura:",
              "     - pizzaIngredientId: Obligatorio.",
              "     - half: Mitad de la pizza donde se coloca el ingrediente ('full' para toda la pizza, 'left' para mitad izquierda, 'right' para mitad derecha) (obligatorio).",
              "     - action: Acción a realizar con el ingrediente ('add' para añadir, 'remove' para quitar) (obligatorio).",
              "     - Nota: Se pueden personalizar las dos mitades de la pizza por separado, añadiendo o quitando ingredientes en cada mitad. Si la pizza se divide en mitades, solo deben usarse 'left' o 'right', no se debe combinar con 'full'.",
              "   - comments: Opcional, se usan solo para observaciones que no esten en modifiers y sean sobre quitar ingredientes del producto.",
              " - orderType: (Requerido) Tipo de orden ('delivery' para entrega a domicilio, 'pickup' para recoger en restaurante)",
              " - deliveryInfo: (Requerido) Dirección de entrega para pedidos a domicilio (requerido para pedidos a domicilio, Nombre del cliente para recolección de pedidos en restaurante",
              " - scheduledTime: Hora programada para el pedido (opcional, no se ofrece a menos que el cliente solicite programar)",
            ],
          },
        ],
      },
      relevant_menu_items: relevantMenuItems,
    };

    const systemMessage = {
      role: "system",
      content: JSON.stringify(systemMessageContent),
    };

    const messagesWithSystemMessage = [systemMessage, ...relevantMessages];

    console.log("Relevant messages:", messagesWithSystemMessage);

    let response = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: messagesWithSystemMessage,
      tools: tools,
      parallel_tool_calls: false,
    });

    let shouldDeleteConversation = false;

    while (true) {
      console.log(`Iniciando ciclo. Estado actual: ${response.status}`);

      if (response.status === "requires_action") {
        const toolCalls =
          response.required_action.submit_tool_outputs.tool_calls;
        console.log("Tool calls:", toolCalls);

        for (const toolCall of toolCalls) {
          const clientId = conversationId;
          let result;

          switch (toolCall.function.name) {
            case "modify_order":
              result = await modifyOrder(toolCall, clientId);
              shouldDeleteConversation = true;
              return { text: result.output };
              messagesWithStructuredData;
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
              return [
                {
                  text: result.text,
                  sendToWhatsApp: result.sendToWhatsApp,
                  isRelevant: true,
                },
              ];
            default:
              return { error: "Función desconocida" };
          }
        }
      } else {
        try {
          response = await waitForCompletion(response.id, response.id);
          if (response.status === "completed") break;
          if (response.status === "error") {
            return { error: response.message };
          }
        } catch (error) {
          console.error("Error durante la espera:", error);
          return { error: "Error durante la espera: " + error.message };
        }
      }
    }

    console.log(`Solicitud completada. Estado final: ${response.status}`);

    if (response.status === "completed") {
      const messages = await openai.chat.completions.list(response.id);
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
        console.log("Run failed with status:", response.status);
        return { error: "Failed to complete the conversation" };
      }
    } else {
      console.log("Run not completed. Final status:", response.status);
      return { error: "Run not completed. Final status: " + response.status };
    }
  } catch (error) {
    console.error("Error general:", error);
    return { error: "Error al procesar la solicitud: " + error.message };
  }
}

async function selectProducts(toolCall, clientId) {
  const { orderItems, orderType, deliveryInfo } = JSON.parse(
    toolCall.function.arguments
  );

  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/api/create_order`,
      {
        action: "selectProducts",
        orderItems: orderItems,
        clientId: clientId,
        orderType: orderType,
        deliveryInfo: deliveryInfo,
      }
    );

    console.log("Response:", response.data);

    return {
      text: response.data.mensaje,
      sendToWhatsApp: false,
      isRelevant: true,
    };
  } catch (error) {
    console.error("Error al seleccionar los productos:", error);

    if (error.response) {
      const errorMessage = error.response.data?.error || "Error desconocido";
      return { text: errorMessage, sendToWhatsApp: true, isRelevant: true };
    } else {
      return {
        text: "Error al seleccionar los productos. Por favor, inténtalo de nuevo.",
        sendToWhatsApp: true,
        isRelevant: true,
      };
    }
  }
}
