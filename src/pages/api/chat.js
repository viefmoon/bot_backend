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

export async function handleChatRequest(req) {
  const { relevantMessages, conversationId } = req;
  try {
    const relevantMenuItems = await getRelevantMenuItems(relevantMessages);

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
            ejemplos: [
              "Aquí hay algunos ejemplos de ejecución de select_products:",
              `1. Pedido: "Quiero ordenar una orden de papas a la francesa con queso y doble aderezo y una grande mitad lupita sin cebolla y la otra mitad carranza sin jitomate a degollado 33 norte"
          Ejecución: {"orderItems": [{"productId": "P", "productVariantId": "PV1", "selectedModifiers": [{"modifierId": "PM1-2"}], "comments": "Con queso", "quantity": 1}, {"productId": "PZ", "productVariantId": "PZ-V-G", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-12", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-22", "half": "left", "action": "remove"}, {"pizzaIngredientId": "PZ-I-3", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-29", "half": "right", "action": "remove"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "degollado 33 norte"}`,
              `2. Pedido: "Quiero una pizza mexicana grande y que la otra mitad sea De piña y chorizo, tambien unas alitas fritas con salsa picosita aparte a hidalgo 63 norte"
          Ejecución: {"orderItems": [{"productId": "PZ", "productVariantId": "PZ-V-G", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-9", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-33", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "right", "action": "add"}], "quantity": 1}, {"productId": "A", "productVariantId": "AV5", "selectedModifiers": [{"modifierId": "AM1-6"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "hidalgo 63 norte"}`,
              `3. Pedido: "Quiero una pizza grande especial especial con chorizo y jalapeño pero que no tenga queso, ademas una mediana con relleno de queso que sea mitad mexicana sin jitomate y mitad philadephia con champiñones a guadalupe victoria 77 norte"
          Ejecución: {"orderItems": [{"productId": "PZ", "productVariantId": "PZ-V-G", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-1", "half": "full", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "full", "action": "add"}, {"pizzaIngredientId": "PZ-I-27", "half": "full", "action": "add"}], "selectedModifiers": [{"modifierId": "PZ-M1-4"}], "quantity": 1}, {"productId": "PZ", "productVariantId": "PZ-V-MR", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-9", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-29", "half": "left", "action": "remove"}, {"pizzaIngredientId": "PZ-I-17", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-23", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "guadalupe victoria 77 norte"}`,
              `4. Pedido: "Voy a querer una media de alitas picositas, una agua fresca sin hielo y una pizza chica mitad mexicana y mitad especial con piña a morelos 104 poniente"
          Ejecución: {"orderItems": [{"productId": "A", "productVariantId": "AV4", "quantity": 1}, {"productId": "AH", "quantity": 1, "comments": "sin hielo"}, {"productId": "PZ", "productVariantId": "PZ-V-CH", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-9", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-1", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-33", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "morelos 104 poniente"}`,
              `5. Pedido: "Me mandas unas dos ordenes de alitas bbq y una pozza grande especial mitad carnes frias y mitad de puro chorizo, me mandas doble chile de aceite a calle galeana 66 norte. porfavor"
          Ejecución: {"orderItems": [{"productId": "A", "productVariantId": "AV1", "quantity": 2}, {"productId": "PZ", "productVariantId": "PZ-V-G", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-2", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "right", "action": "add"}], "selectedModifiers": [{"modifierId": "PZ-M1-9"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "calle galeana 66 norte"}`,
              `6. Pedido: "Me mandas una margarita sin alcohol , una coca, un seven up y una limonada mineral sin hielo y sin azucar, y ademas una pizza mediana con relleno de orilla mitad villa con slachicha y mitad margarita con cebolla a ocampo 304 oriente"
          Ejecución: {"orderItems": [{"productId": "MAR", "quantity": 1, "comments": "sin alcohol"}, {"productId": "RCC", "quantity": 1}, {"productId": "R7UP", "quantity": 1}, {"productId": "LIMM", "quantity": 1, "comments": "sin hielo y sin azúcar"}, {"productId": "PZ", "productVariantId": "PZ-V-MR", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-5", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-37", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-6", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-22", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "ocampo 304 oriente"}`,
              `7. Pedido: "Me mandas una ensalada chica de jamon con vinagreta y una pizza grande con relleno  la maria con chorizo y piña, me le pones doble aderezo y chile de aceite a degollado 13 norte"
          Ejecución: {"orderItems": [{"productId": "E", "productVariantId": "EV3", "quantity": 1, "selectedModifiers": [{"modifierId": "EM1-3"}]}, {"productId": "PZ", "productVariantId": "PZ-V-GR", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-15", "half": "full", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "full", "action": "add"}, {"pizzaIngredientId": "PZ-I-33", "half": "full", "action": "add"}], "selectedModifiers": [{"modifierId": "PZ-M1-8"}, {"modifierId": "PZ-M1-9"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "degollado 13 norte"}`,
              `8. Pedido: "Me haces una ensalada de pollo grande con doble pollo pero que sea sin jitomate y sin chile morron, tambien quiero una pizza chica mitad adelita y mitad zapata con chorizo y chile jalapeño me lo envias a ramon corona 65 en una casa blanca"
          Ejecución: {"orderItems": [{"productId": "E", "productVariantId": "EV2", "quantity": 1, "selectedModifiers": [{"modifierId": "EM1-4"}], "comments": "sin jitomate y sin chile morrón"}, {"productId": "PZ", "productVariantId": "PZ-V-CH", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-7", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-4", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-27", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "ramon corona 65, casa blanca"}`,
              `9. Pedido: "Me haces una orden y media de alitas bbq con extra salsa y una pizza grande con orilla rellena de mitad especial sin salchicha y la otra mitad malinche con chorizo, me lo envias a zaragoza 71 norte"
          Ejecución: {"orderItems": [{"productId": "A", "productVariantId": "AV1", "quantity": 1, "selectedModifiers": [{"modifierId": "AM1-3"}]}, {"productId": "A", "productVariantId": "AV2", "quantity": 1, "selectedModifiers": [{"modifierId": "AM1-3"}]}, {"productId": "PZ", "productVariantId": "PZ-V-GR", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-1", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-37", "half": "left", "action": "remove"}, {"pizzaIngredientId": "PZ-I-16", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "zaragoza 71 norte"}`,
              `10. Pedido: "Voy a querer una media orden de papas a la francesa con queso y una media orden de alitas fritas con salsa bbq aparte y doble chile de aceite y una hamburguesa leñazo sin papas y sin jitomate ni lechuga y una michelada clara y un freppe de capichino me lo envias a felipe angeles 52"
          Ejecución: {"orderItems": [{"productId": "P", "productVariantId": "PV2", "quantity": 1}, {"productId": "A", "productVariantId": "AV6", "quantity": 1, "selectedModifiers": [{"modifierId": "AM1-7"}, {"modifierId": "AM1-8"}]}, {"productId": "H", "productVariantId": "HV6", "quantity": 1, "comments": "sin jitomate ni lechuga"}, {"productId": "MICH", "productVariantId": "MV1", "quantity": 1}, {"productId": "F", "productVariantId": "FV1", "quantity": 1}], "orderType": "delivery", "deliveryInfo": "felipe angeles 52"}`,
            ],
          },
        ],
      },
    };

    const systemMessage = {
      role: "system",
      content: JSON.stringify(systemMessageContent),
    };

    const lastUserMessageIndex = relevantMessages.findLastIndex(
      (msg) => msg.role === "user"
    );

    if (lastUserMessageIndex !== -1) {
      // Anexar relevantMenuItems al último mensaje del usuario
      relevantMessages[
        lastUserMessageIndex
      ].content += `\n\nRelevant menu items, solo estos son los id disponibles, si no existe el id, no lo incluyas, las observaciones que no estan registradas en el menu se registran como comentario: ${JSON.stringify(
        relevantMenuItems
      )}`;

      // Añadir mensaje para reinterpretar y extraer artículos
      relevantMessages[
        lastUserMessageIndex
      ].content += `\n\nPor favor, reinterpreta minuciosamente el mensaje del cliente y extrae todos los artículos mencionados, incluyendo cantidades, variantes, modificadores e ingredientes específicos si se mencionan. Asegúrate de no omitir ningún detalle relevante del pedido.`;
    }

    const messagesWithSystemMessage = [systemMessage, ...relevantMessages];

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
