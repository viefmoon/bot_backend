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
const {
  selectProductsTool,
  preprocessOrderTool,
} = require("../../aiTools/aiTools");

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
      const cleanProduct = removeKeywords(product);

      if (cleanProduct.productVariants) {
        cleanProduct.productVariants =
          cleanProduct.productVariants.map(removeKeywords);
      }

      if (cleanProduct.modifiers) {
        cleanProduct.modifiers = cleanProduct.modifiers.map(removeKeywords);
      }

      if (cleanProduct.pizzaIngredients) {
        cleanProduct.pizzaIngredients =
          cleanProduct.pizzaIngredients.map(removeKeywords);
      }

      return cleanProduct;
    }
  );

  const relevantMenu = {
    menu,
  };
  return relevantMenu;
}

async function preprocessMessages(messages) {
  const systemMessageForPreprocessing = {
    role: "system",
    content: JSON.stringify({
      instrucciones: [
        "Analiza el mensaje del usuario y utiliza la función 'preprocess_order' para crear una lista detallada de los productos mencionados y la información de entrega.",
      ],
    }),
  };

  const preprocessingMessages = [systemMessageForPreprocessing, ...messages];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: preprocessingMessages,
    tools: preprocessOrderTool,
    parallel_tool_calls: false,
  });

  if (response.choices[0].message.tool_calls) {
    const toolCall = response.choices[0].message.tool_calls.find(
      (call) => call.function.name === "preprocess_order"
    );

    if (toolCall) {
      console.log("toolCall", toolCall);
      return JSON.parse(toolCall.function.arguments);
    }
  } else {
    console.error("No se pudo preprocesar el mensaje");
    return "Error al preprocesar el mensaje";
  }
}

export async function handleChatRequest(req) {
  const { relevantMessages, conversationId } = req;
  try {
    const relevantMenuItems = await getRelevantMenuItems(relevantMessages);

    // Preprocesar los mensajes
    const preprocessedContent = await preprocessMessages(relevantMessages);

    const systemSelectProductsMessage = {
      role: "system",
      content: JSON.stringify({
        instrucciones: [
          {
            title: "Selección de productos",
            detalles: [
              "En base al listado de productos y el menú disponible llama a la función `select_products` con los siguientes parámetros:",
              " - orderItems: Lista de ítems ordenados con la siguiente estructura para cada ítem:",
              "   - productId: (Requerido) para todos los orderItems.",
              "   - productVariantId: Requerido solo si el producto tiene variantes.",
              "   - quantity: (Requerido) indica la cantidad del producto.",
              "   - selectedModifiers: Modificadores seleccionados para el producto.",
              "   - selectedPizzaIngredients: Obligatorio para pizzas, debes incluir al menos un ingrediente. Es un array de ingredientes con la siguiente estructura:",
              "     - pizzaIngredientId: (Requerido).",
              "     - half: (Requerido) Mitad de la pizza donde se coloca el ingrediente ('full' para toda la pizza, 'left' para mitad izquierda, 'right' para mitad derecha).",
              "     - action: (Requerido) Acción a realizar con el ingrediente ('add' para añadir, 'remove' para quitar).",
              "     - Nota: Se pueden personalizar las dos mitades de la pizza por separado, añadiendo o quitando ingredientes en cada mitad. Si la pizza se divide en mitades, solo deben usarse 'left' o 'right', no se debe combinar con 'full'.",
              "   - comments: Opcional, se usan solo para observaciones que no estén definidas en los modificadores del producto.",
              " - orderType: (Requerido) Tipo de orden ('delivery' para entrega a domicilio, 'pickup' para recoger en restaurante)",
              " - deliveryInfo: (Requerido) Dirección de entrega para pedidos a domicilio (requerido para pedidos a domicilio), Nombre del cliente para recolección de pedidos en restaurante",
              " - scheduledTime: Hora programada para el pedido",
            ],
          },
        ],
      }),
    };

    const userSelectProductsMessage = {
      role: "user",
      content:
        `${JSON.stringify(preprocessedContent)}\n\n` +
        `Menu disponible: NOTA: las observaciones que no estan registradas en el menu se registran como comentario: ${JSON.stringify(
          relevantMenuItems
        )}`,
    };

    const selectProductsMessages = [
      systemSelectProductsMessage,
      userSelectProductsMessage,
    ];

    console.log("Select Products message:", selectProductsMessages);

    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: selectProductsMessages,
      tools: selectProductsTool,
      parallel_tool_calls: false,
      tool_choice: {
        type: "function",
        function: { name: "select_products" },
      },
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
