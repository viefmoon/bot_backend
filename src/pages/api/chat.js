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
        keywords: producto.keywords || null,
        //active: producto.Availability?.available || false,
      };

      // Agregar variantes
      if (producto.productVariants?.length > 0) {
        productoInfo.variantes = producto.productVariants.map((v) => ({
          variantId: v.id,
          name: v.name,
          keywords: v.keywords || null,
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
              keywords: m.keywords || null,
              //active: m.Availability?.available || false,
            })) || []
        );
      }

      // Agregar ingredientes de pizza
      if (producto.pizzaIngredients?.length > 0) {
        productoInfo.ingredientesPizza = producto.pizzaIngredients.map((i) => ({
          pizzaIngredientId: i.id,
          name: i.name,
          keywords: i.keywords || null,
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

function extractMentionedProducts(message, menu) {
  const mentionedProducts = [];
  const words = message.split(/\s+/);

  function normalizeWord(word) {
    return word
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function checkKeywords(keywords, words) {
    if (!keywords) return false;
    const normalizedWords = words.map(normalizeWord);

    if (Array.isArray(keywords[0])) {
      return keywords.every((group) =>
        group.some((keyword) =>
          normalizedWords.some(
            (word) =>
              word.length > 2 &&
              partial_ratio(normalizeWord(keyword), word) > 83
          )
        )
      );
    } else {
      return keywords.some((keyword) =>
        normalizedWords.some(
          (word) =>
            word.length > 2 && partial_ratio(normalizeWord(keyword), word) > 83
        )
      );
    }
  }

  for (const product of menu["Menu Disponible"]) {
    let isProductMentioned = checkKeywords(product.keywords, words);

    if (isProductMentioned) {
      const mentionedProduct = {
        productId: product.productId,
        name: product.name,
      };

      // Verificar variantes
      if (product.variantes) {
        mentionedProduct.productVariants = product.variantes.filter((variant) =>
          checkKeywords(variant.keywords, words)
        );
      }

      // Verificar modificadores
      if (product.modificadores) {
        mentionedProduct.modifiers = product.modificadores.filter((modifier) =>
          checkKeywords(modifier.keywords, words)
        );
      }

      // Verificar ingredientes de pizza
      if (product.ingredientesPizza) {
        mentionedProduct.pizzaIngredients = product.ingredientesPizza.filter(
          (ingredient) => checkKeywords(ingredient.keywords, words)
        );
      }

      console.log("Producto mencionado:", mentionedProduct);
      mentionedProducts.push(mentionedProduct);
    }
  }
  return mentionedProducts;
}

function removeKeywords(item) {
  const { keywords, ...itemWithoutKeywords } = item;
  return itemWithoutKeywords;
}

async function getRelevantMenuItems(relevantMessages) {
  const fullMenu = await getMenuAvailability();
  let menu = [];

  for (const message of relevantMessages) {
    if (message.role === "user") {
      const productsInMessage = extractMentionedProducts(
        message.content,
        fullMenu
      );
      menu = [...menu, ...productsInMessage];
    }
  }

  menu = Array.from(new Set(menu.map(JSON.stringify)), JSON.parse).map(
    (product) => {
      const formattedProduct = {
        productName: `${product.name} (${product.productId})`,
      };

      if (product.productVariants && product.productVariants.length > 0) {
        formattedProduct.productVariants = product.productVariants.map(
          (variant) => `${variant.name} (${variant.variantId})`
        );
      }

      if (product.modifiers && product.modifiers.length > 0) {
        formattedProduct.modifiers = product.modifiers.map(
          (modifier) => `${modifier.name} (${modifier.modifierId})`
        );
      }

      if (product.pizzaIngredients && product.pizzaIngredients.length > 0) {
        formattedProduct.pizzaIngredients = product.pizzaIngredients.map(
          (ingredient) => `${ingredient.name} (${ingredient.pizzaIngredientId})`
        );
      }

      return formattedProduct;
    }
  );

  const relevantMenu = {
    menu,
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
      strict: false,
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
                  description: "ID del producto.",
                },
                productVariantId: {
                  type: ["string"],
                  description: "ID de la variante del producto (si aplica).",
                },
                selectedPizzaIngredients: {
                  type: "array",
                  description:
                    "Lista de ingredientes seleccionados para la pizza (si aplica).",
                  items: {
                    type: "object",
                    properties: {
                      pizzaIngredientId: {
                        type: "string",
                        description: "ID del ingrediente de la pizza.",
                      },
                      half: {
                        type: "string",
                        enum: ["full", "left", "right"],
                        description:
                          "Mitad de la pizza donde se coloca el ingrediente.",
                      },
                      action: {
                        type: "string",
                        enum: ["add", "remove"],
                        description:
                          "Acción a realizar con el ingrediente: añadir o quitar.",
                      },
                    },
                    required: ["pizzaIngredientId", "half", "action"],
                    additionalProperties: false,
                  },
                },
                selectedModifiers: {
                  type: "array",
                  description:
                    "Lista de modificadores seleccionados (si aplica).",
                  items: {
                    type: "object",
                    properties: {
                      modifierId: {
                        type: "string",
                        description: "ID del modificador.",
                      },
                    },
                    required: ["modifierId"],
                    additionalProperties: false,
                  },
                },
                comments: {
                  type: ["string"],
                  description: "Comentarios del producto.",
                },
                quantity: {
                  type: "integer",
                  description: "Cantidad del ítem.",
                },
              },
              required: ["productId", "quantity"],
              additionalProperties: false,
            },
          },
          orderType: {
            type: ["string"],
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

async function preprocessMessages(messages) {
  const systemMessageForPreprocessing = {
    role: "system",
    content: JSON.stringify({
      instrucciones: [
        "Analiza el mensaje del usuario y crea una lista detallada de los productos mencionados.",
        "Ejemplo de entrada:",
        "Quiero una pizza grande especial especial con chorizo y jalapeño pero que no tenga queso, ademas una mediana con relleno de queso que sea mitad mexicana sin jitomate y mitad philadephia con champiñones a guadalupe victoria 77 norte",
        "Ejemplo de salida:",
        "1 Pizza grande especial con chorizo y jalapeño, sin queso",
        "1 Pizza mediana con orilla rellena de queso, mitad mexicana sin jitomate, mitad philadelphia con champiñones",
        "Entrega a: Guadalupe Victoria 77 Norte",
        "Ejemplo de entrada:",
        "Quiero una orden de papas gajo orden y media de alas bbq para llevar a la direccion de jose ma. ortega 19 sur",
        "Ejemplo de salida:",
        "1 Orden de papas gajo",
        "1 Media orden de alas BBQ",
        "1 Orden completa de alas BBQ",
        "Direccion de entrega: Jose Ma. Ortega 19 sur",
      ],
    }),
  };

  const preprocessingMessages = [systemMessageForPreprocessing, ...messages];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: preprocessingMessages,
  });

  return response.choices[0].message.content;
}

export async function handleChatRequest(req) {
  const { relevantMessages, conversationId } = req;
  try {
    const relevantMenuItems = await getRelevantMenuItems(relevantMessages);

    // Preprocesar los mensajes
    const preprocessedContent = await preprocessMessages(relevantMessages);

    const systemMessageContent = {
      configuracion: {
        funcion:
          "Eres un asistente virtual del Restaurante La Leña, especializado en la seleccion de productos. Utilizas emojis en tus interacciones para crear una experiencia amigable, manten las interacciones rapidas y eficaces.",
        instrucciones: [
          {
            title: "Seleccion de productos",
            detalles: [
              "Es OBLIGATORIO ejecutar la función `select_products` cada vez que se elija un nuevo producto o varios,no confirmes con el cliente ejecutala directamente, se modifique un producto existente o se elimine un producto.",
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
              "   - comments: Opcional, se usan solo para observaciones que no esten definidas en los modificadores del producto.",
              " - orderType: (Requerido) Tipo de orden ('delivery' para entrega a domicilio, 'pickup' para recoger en restaurante)",
              " - deliveryInfo: (Requerido) Dirección de entrega para pedidos a domicilio (requerido para pedidos a domicilio, Nombre del cliente para recolección de pedidos en restaurante",
              " - scheduledTime: Hora programada para el pedido (opcional, no se ofrece a menos que el cliente solicite programar)",
            ],
          },
        ],
      },
    };

    const systemMessage = {
      role: "system",
      content: JSON.stringify(systemMessageContent),
    };

    const userMessageWithPreprocessedContent = {
      role: "user",
      content: `${preprocessedContent}\n\nRelevant menu items, solo estos son los id disponibles, si no existe el id, no lo incluyas, las observaciones que no estan registradas en el menu se registran como comentario: ${JSON.stringify(
        relevantMenuItems
      )}`,
    };

    const messagesWithSystemMessage = [
      systemMessage,
      userMessageWithPreprocessedContent,
    ];

    console.log("Relevant messages:", messagesWithSystemMessage);

    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messagesWithSystemMessage,
      tools: tools,
      parallel_tool_calls: false,
    });

    let shouldDeleteConversation = false;

    // Manejar la respuesta directamente
    if (response.choices[0].message.tool_calls) {
      const toolCalls = response.choices[0].message.tool_calls;
      for (const toolCall of toolCalls) {
        console.log("toolCall", toolCall);
        const clientId = conversationId;
        let result;

        switch (toolCall.function.name) {
          case "modify_order":
            result = await modifyOrder(toolCall, clientId);
            shouldDeleteConversation = true;
            return { text: result.output };
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
      // Si no hay llamadas a funciones, manejar la respuesta normal
      const assistantMessage = response.choices[0].message.content;
      return { text: assistantMessage };
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
