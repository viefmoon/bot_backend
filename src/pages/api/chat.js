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
  selectProductsToolClaude,
} = require("../../aiTools/aiTools");
const Anthropic = require("@anthropic-ai/sdk");

// Inicializa el cliente de Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
async function getAvailableMenu() {
  try {
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
          include: [{ model: Availability, where: { available: true } }],
        },
        {
          model: PizzaIngredient,
          as: "pizzaIngredients",
          include: [{ model: Availability, where: { available: true } }],
        },
        {
          model: ModifierType,
          as: "modifierTypes",
          include: [
            { model: Availability, where: { available: true } },
            {
              model: Modifier,
              as: "modifiers",
              include: [{ model: Availability, where: { available: true } }],
            },
          ],
        },
        { model: Availability, where: { available: true } },
      ],
    });

    if (!products || products.length === 0) {
      console.error("No se encontraron productos disponibles");
      return {
        error: "No se encontraron productos disponibles en la base de datos",
      };
    }

    return products.map((producto) => {
      const productoInfo = {
        name: producto.name,
      };

      if (producto.productVariants?.length > 0) {
        productoInfo.variantes = producto.productVariants.map((v) => v.name);
      }

      if (producto.modifierTypes?.length > 0) {
        productoInfo.modificadores = producto.modifierTypes.flatMap(
          (mt) => mt.modifiers?.map((m) => m.name) || []
        );
      }

      if (producto.pizzaIngredients?.length > 0) {
        productoInfo.ingredientesPizza = producto.pizzaIngredients.map(
          (i) => i.name
        );
      }

      return productoInfo;
    });
  } catch (error) {
    console.error("Error al obtener el menú disponible:", error);
    return {
      error: "No se pudo obtener el menú disponible",
      detalles: error.message,
      stack: error.stack,
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
  const wordsToFilter = [
    "del",
    "los",
    "las",
    "una",
    "unos",
    "unas",
    "pero",
    "para",
  ];
  function normalizeWord(word) {
    return word
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const words = message
    .split(/\s+/)
    .map(normalizeWord)
    .filter((word) => word.length >= 3 && !wordsToFilter.includes(word));

  function checkKeywords(keywords, filteredWords) {
    if (!keywords) return false;

    if (Array.isArray(keywords[0])) {
      return keywords.every((group) =>
        group.some((keyword) =>
          filteredWords.some(
            (word) => partial_ratio(normalizeWord(keyword), word) > 90
          )
        )
      );
    } else {
      return keywords.some((keyword) =>
        filteredWords.some(
          (word) => partial_ratio(normalizeWord(keyword), word) > 90
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

async function getRelevantMenuItems(preprocessedContent) {
  const fullMenu = await getMenuAvailability();
  let productos = [];

  for (const product of preprocessedContent.orderItems) {
    const productsInMessage = extractMentionedProducts(product, fullMenu);
    productos = [...productos, ...productsInMessage];
  }

  productos = Array.from(
    new Set(productos.map(JSON.stringify)),
    JSON.parse
  ).map((producto) => {
    const productoLimpio = removeKeywords(producto);

    if (productoLimpio.productVariants?.length) {
      productoLimpio.productVariants =
        productoLimpio.productVariants.map(removeKeywords);
    } else {
      delete productoLimpio.productVariants;
    }

    if (productoLimpio.modifiers?.length) {
      productoLimpio.modifiers = productoLimpio.modifiers.map(removeKeywords);
    } else {
      delete productoLimpio.modifiers;
    }

    if (productoLimpio.pizzaIngredients?.length) {
      productoLimpio.pizzaIngredients =
        productoLimpio.pizzaIngredients.map(removeKeywords);
    } else {
      delete productoLimpio.pizzaIngredients;
    }

    return productoLimpio;
  });

  return productos;
}

async function preprocessMessages(messages) {
  const availableMenu = await getAvailableMenu();

  const systemMessageForPreprocessing = {
    role: "system",
    content: JSON.stringify({
      instrucciones: [
        "Analiza el mensaje del usuario y utiliza la función 'preprocess_order' para crear una lista detallada de los productos mencionados con sus detalles y la información de entrega.",
      ],
    }),
  };

  const assistantMessageWithMenu = {
    role: "assistant",
    content: JSON.stringify({
      "MENU DISPONIBLE": availableMenu,
    }),
  };

  const preprocessingMessages = [
    systemMessageForPreprocessing,
    assistantMessageWithMenu,
    ...messages,
  ];

  console.log("preprocessingMessages", preprocessingMessages);

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
      const preprocessedContent = JSON.parse(toolCall.function.arguments);

      if (Array.isArray(preprocessedContent.orderItems)) {
        for (const item of preprocessedContent.orderItems) {
          if (item && typeof item.description === "string") {
            item.relevantMenuItems = await getRelevantMenuItems({
              orderItems: [item.description],
            });
          } else {
            console.error("Item inválido o sin descripción:", item);
          }
        }
      } else {
        console.error(
          "orderItems no es un array:",
          preprocessedContent.orderItems
        );
      }

      return preprocessedContent;
    }
  } else {
    console.error("No se pudo preprocesar el mensaje");
    return "Error al preprocesar el mensaje";
  }
}

export async function handleChatRequest(req) {
  const { relevantMessages, conversationId } = req;
  try {
    // Preprocesar los mensajes
    const preprocessedContent = await preprocessMessages(relevantMessages);

    const systemContent = [
      "Basándote en el objeto proporcionado, utiliza la función `select_products`",
      "- Utiliza los `relevantMenuItems` proporcionados para mapear las descripciones de los productos a sus respectivos IDs.",
      "- No es necesario usar todos los relevantMenuItems si no aplican",
      "- Es OBLIGATORIO usar la función `select_products` para completar esta tarea.",
    ].join("\n");

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      system: systemContent,
      messages: [
        { role: "user", content: JSON.stringify(preprocessedContent) },
      ],
      max_tokens: 4096,
      tools: [selectProductsToolClaude],
      tool_choice: { type: "tool", name: "select_products" },
    });

    console.log(
      "response claude",
      JSON.stringify(
        response,
        (key, value) => {
          if (key === "input" && typeof value === "object") {
            return JSON.stringify(value);
          }
          return value;
        },
        2
      )
    );

    let shouldDeleteConversation = false;

    // Manejar la respuesta directamente
    if (response.content) {
      const toolUses = response.content;
      for (const toolUse of toolUses) {
        console.log("toolUse", toolUse);
        const clientId = conversationId;
        let result;

        if (toolUse.type === "tool_use" && toolUse.name === "select_products") {
          result = await selectProducts(toolUse, clientId);
          return [
            {
              text: result.text,
              sendToWhatsApp: result.sendToWhatsApp,
              isRelevant: true,
            },
          ];
        }
      }
    }

    // switch (toolCall.function.name) {
    //   case "modify_order":
    //     result = await modifyOrder(toolCall, clientId);
    //     shouldDeleteConversation = true;
    //     return { text: result.output };
    //   case "send_menu":
    //     return [
    //       { text: menu, isRelevant: false },
    //       {
    //         text: "El menú ha sido enviado, si tienes alguna duda, no dudes en preguntar",
    //         isRelevant: true,
    //       },
    //     ];
    //   case "select_products":
    //     result = await selectProducts(toolCall, clientId);
    //     return [
    //       {
    //         text: result.text,
    //         sendToWhatsApp: result.sendToWhatsApp,
    //         isRelevant: true,
    //       },
    //     ];
    //   default:
    //     return { error: "Función desconocida" };
    // }
    //   }
    // } else {
    //   // Si no hay llamadas a funciones, manejar la respuesta normal
    //   const assistantMessage = response.choices[0].message.content;
    //   return { text: assistantMessage };
    // }
  } catch (error) {
    console.error("Error general:", error);
    return { error: "Error al procesar la solicitud: " + error.message };
  }
}

async function selectProducts(toolCall, clientId) {
  const { orderItems, orderType, deliveryInfo } = JSON.parse(toolCall.input);

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
