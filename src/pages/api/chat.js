import dotenv from "dotenv";
dotenv.config();
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
const { ratio } = require("fuzzball");
const {
  selectProductsTool,
  preprocessOrderTool,
  selectProductsToolClaude,
  sendMenuTool,
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
        ingredients: producto.ingredients || undefined,
        variantes:
          producto.productVariants?.map((v) => ({
            name: v.name,
            ingredients: v.ingredients || undefined,
          })) || [],
        modificadores:
          producto.modifierTypes?.flatMap(
            (mt) => mt.modifiers?.map((m) => m.name) || []
          ) || [],
        ingredientesPizza:
          producto.pizzaIngredients?.map((i) => ({
            name: i.name,
          })) || [],
      };

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

async function getAvailableMenu() {
  try {
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

    return products
      .map((producto) => {
        const productoInfo = {
          name: producto.name,
          ingredients: producto.ingredients || undefined,
        };

        if (producto.productVariants?.length > 0) {
          productoInfo.variantes = producto.productVariants.map((v) => ({
            name: v.name,
            ingredients: v.ingredients || undefined,
          }));
        }

        if (producto.modifierTypes?.length > 0) {
          productoInfo.modificadores = producto.modifierTypes.flatMap(
            (mt) => mt.modifiers?.map((m) => m.name) || []
          );
        }

        if (producto.pizzaIngredients?.length > 0) {
          productoInfo.ingredientesPizza = producto.pizzaIngredients.map(
            (i) => ({
              name: i.name,
            })
          );
        }

        return productoInfo;
      })
      .filter(
        (p) =>
          p.ingredients !== undefined ||
          p.variantes?.length > 0 ||
          p.modificadores?.length > 0 ||
          p.ingredientesPizza?.length > 0
      );
  } catch (error) {
    console.error("Error al obtener el menú disponible:", error);
    return {
      error: "No se pudo obtener el menú disponible",
      detalles: error.message,
      stack: error.stack,
    };
  }
}

function extractMentionedProducts(productMessage, menu) {
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

  const words = productMessage
    .split(/\s+/)

    .map(normalizeWord)
    .filter((word) => word.length >= 3 && !wordsToFilter.includes(word));

  function checkKeywords(keywords, filteredWords) {
    if (!keywords) return false;

    function compareWords(keyword, word) {
      const similarity = ratio(normalizeWord(keyword), word);
      const lengthDifference = Math.abs(keyword.length - word.length);

      // Ajustamos los umbrales según la longitud de las palabras
      if (keyword.length <= 3) {
        return similarity === 100 && lengthDifference === 0;
      } else if (keyword.length <= 5) {
        return similarity >= 90 && lengthDifference <= 1;
      } else {
        return similarity >= 85 && lengthDifference <= 2;
      }
    }

    if (Array.isArray(keywords[0])) {
      return keywords.every((group) =>
        group.some((keyword) =>
          filteredWords.some((word) => compareWords(keyword, word))
        )
      );
    } else {
      return keywords.some((keyword) =>
        filteredWords.some((word) => compareWords(keyword, word))
      );
    }
  }

  for (const product of menu["Menu Disponible"]) {
    let isProductMentioned = checkKeywords(product.keywords, words);

    if (isProductMentioned) {
      let mentionedProduct = {};

      // Verificar variantes
      if (product.variantes) {
        const matchedVariants = product.variantes.filter((variant) =>
          checkKeywords(variant.keywords, words)
        );

        if (matchedVariants.length > 0) {
          mentionedProduct.products = matchedVariants.map((variant) => ({
            productId: variant.variantId,
            name: variant.name,
          }));
        } else {
          continue; // Si no hay variantes coincidentes, saltamos este producto
        }
      } else {
        // Si no hay variantes, incluimos el productId y name del producto principal
        mentionedProduct.productId = product.productId;
        mentionedProduct.name = product.name;
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
        "Eres un asistente virtual del Restaurante La Leña, especializado en la selección de productos. Utilizas emojis en tus interacciones para crear una experiencia amigable y cercana.",
        "Analiza los mensajes entre usuario y asistente, utiliza la función 'preprocess_order' para crear una lista detallada de los productos mencionados con sus cantidades y detalles, la información de entrega y un resumen extenso de la conversación.",
        "Mantén las interacciones rápidas y eficaces.",
        "No ofrezcas extras o modificadores si el cliente no los ha mencionado explícitamente.",
        "La función `send_menu` debe ejecutarse única y exclusivamente cuando el cliente solicite explícitamente ver el menú.",
        "La función `preprocess_order` se ejecuta cuando el cliente menciona productos, esta contiene cantidad y descripcion de cada producto, la informacion de entrega debe ser proporcionada por el cliente, si no se proporciona, se debe solicitar antes de ejecutar la funcion.",
        "Puedes proporcionar la siguiente información del restaurante cuando el cliente la solicite:",
        "🍕 Información y horarios de La Leña:",
        "📍 Ubicación: C. Ogazón Sur 36, Centro, 47730 Tototlán, Jal.",
        "📞 Teléfonos: Fijo: 3919160126, Celular: 3338423316",
        "🕒 Horarios: Martes a sábado: 6:00 PM - 11:00 PM, Domingos: 2:00 PM - 11:00 PM",
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
    tools: [...preprocessOrderTool, ...sendMenuTool],
    parallel_tool_calls: false,
  });

  if (response.choices[0].message.tool_calls) {
    const toolCall = response.choices[0].message.tool_calls[0];
    if (toolCall.function.name === "preprocess_order") {
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
    } else if (toolCall.function.name === "send_menu") {
      return {
        text: menu,
        isDirectResponse: true,
        isRelevant: false,
        confirmationMessage:
          "El menú ha sido enviado. ¿Hay algo más en lo que pueda ayudarte?",
      };
    }
  } else if (response.choices[0].message.content) {
    console.log("No se ejecutó preprocessOrderTool, retornando texto");
    return {
      text: response.choices[0].message.content,
      isDirectResponse: true,
      isRelevant: true,
    };
  } else {
    console.error("No se pudo preprocesar el mensaje");
    return {
      text: "Error al preprocesar el mensaje",
      isDirectResponse: true,
      isRelevant: true,
    };
  }
}

export async function handleChatRequest(req) {
  const { relevantMessages, conversationId } = req;
  try {
    // Preprocesar los mensajes
    const preprocessedContent = await preprocessMessages(relevantMessages);

    // Si preprocessMessages retorna una respuesta directa
    if (preprocessedContent.isDirectResponse) {
      return [
        {
          text: preprocessedContent.text,
          sendToWhatsApp: true,
          isRelevant: preprocessedContent.isRelevant,
          confirmationMessage: preprocessedContent.confirmationMessage,
        },
      ];
    }

    const systemContent = [
      "Basándote en el objeto proporcionado, utiliza la función `select_products`",
      "- Utiliza los `relevantMenuItems` proporcionados para mapear las descripciones de los productos a sus respectivos IDs.",
      "- No es necesario usar todos los relevantMenuItems si no aplican",
      "- Es OBLIGATORIO usar la función `select_products` para completar esta tarea.",
    ].join("\n");

    console.log(
      "preprocessedContent",
      JSON.stringify(
        preprocessedContent,
        (key, value) => {
          if (key === "relevantMenuItems") {
            return JSON.parse(JSON.stringify(value));
          }
          return value;
        },
        2
      )
    );

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
    return [
      {
        text: "Error al procesar la solicitud: " + error.message,
        sendToWhatsApp: true,
        isRelevant: true,
      },
    ];
  }
}

async function selectProducts(toolCall, clientId) {
  const { orderItems, orderType, deliveryInfo } = toolCall.input;

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
