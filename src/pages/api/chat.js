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

export async function handleChatRequest(req) {
  const { relevantMessages, conversationId } = req;
  try {
    const relevantMenuItems = await getRelevantMenuItems(relevantMessages);

    const menuAvailabilityMessage = {
      role: "user",
      content: JSON.stringify(relevantMenuItems),
    };

    const menuInstructions = {
      role: "assistant",
      content: `Aquí hay algunos ejemplos de ejecución de select_products:

      1. Pedido: "Quiero ordenar una orden de papas a la francesa con queso y doble aderezo y una grande mitad lupita sin cebolla y la otra mitad carranza sin jitomate a degollado 33 norte"
      Ejecución: {"orderItems": [{"productId": "P", "productVariantId": "PV1", "selectedModifiers": [{"modifierId": "PM1-2"}], "comments": "Con queso", "quantity": 1}, {"productId": "PZ", "productVariantId": "PZ-V-G", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-12", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-22", "half": "left", "action": "remove"}, {"pizzaIngredientId": "PZ-I-3", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-29", "half": "right", "action": "remove"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "degollado 33 norte"}

      2. Pedido: "Quiero una pizza mexicana grande y que la otra mitad sea De piña y chorizo, tambien unas alitas fritas con salsa picosita aparte a hidalgo 63 norte"
      Ejecución: {"orderItems": [{"productId": "PZ", "productVariantId": "PZ-V-G", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-9", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-33", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "right", "action": "add"}], "quantity": 1}, {"productId": "A", "productVariantId": "AV5", "selectedModifiers": [{"modifierId": "AM1-6"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "hidalgo 63 norte"}

      3. Pedido: "Quiero una pizza grande especial especial con chorizo y jalapeño pero que no tenga queso, ademas una mediana con relleno de queso que sea mitad mexicana sin jitomate y mitad philadephia con champiñones a guadalupe victoria 77 norte"
      Ejecución: {"orderItems": [{"productId": "PZ", "productVariantId": "PZ-V-G", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-1", "half": "full", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "full", "action": "add"}, {"pizzaIngredientId": "PZ-I-27", "half": "full", "action": "add"}], "selectedModifiers": [{"modifierId": "PZ-M1-4"}], "quantity": 1}, {"productId": "PZ", "productVariantId": "PZ-V-MR", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-9", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-29", "half": "left", "action": "remove"}, {"pizzaIngredientId": "PZ-I-17", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-23", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "guadalupe victoria 77 norte"}

      4. Pedido: "Voy a querer una media de alitas picositas, una agua fresca sin hielo y una pizza chica mitad mexicana y mitad especial con piña a morelos 104 poniente"
      Ejecución: {"orderItems": [{"productId": "A", "productVariantId": "AV4", "quantity": 1}, {"productId": "AH", "quantity": 1, "comments": "sin hielo"}, {"productId": "PZ", "productVariantId": "PZ-V-CH", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-9", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-1", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-33", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "morelos 104 poniente"}

      5. Pedido: "Me mandas unas dos ordenes de alitas bbq y una pozza grande especial mitad carnes frias y mitad de puro chorizo, me mandas doble chile de aceite a calle galeana 66 norte. porfavor"
      Ejecución: {"orderItems": [{"productId": "A", "productVariantId": "AV1", "quantity": 2}, {"productId": "PZ", "productVariantId": "PZ-V-G", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-2", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "right", "action": "add"}], "selectedModifiers": [{"modifierId": "PZ-M1-9"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "calle galeana 66 norte"}

      6. Pedido: "Me mandas una margarita sin alcohol , una coca, un seven up y una limonada mineral sin hielo y sin azucar, y ademas una pizza mediana con relleno de orilla mitad villa con slachicha y mitad margarita con cebolla a ocampo 304 oriente"
      Ejecución: {"orderItems": [{"productId": "MAR", "quantity": 1, "comments": "sin alcohol"}, {"productId": "RCC", "quantity": 1}, {"productId": "R7UP", "quantity": 1}, {"productId": "LIMM", "quantity": 1, "comments": "sin hielo y sin azúcar"}, {"productId": "PZ", "productVariantId": "PZ-V-MR", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-5", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-37", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-6", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-22", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "ocampo 304 oriente"}

      7. Pedido: "Me mandas una ensalada chica de jamon con vinagreta y una pizza grande con relleno  la maria con chorizo y piña, me le pones doble aderezo y chile de aceite a degollado 13 norte"
      Ejecución: {"orderItems": [{"productId": "E", "productVariantId": "EV3", "quantity": 1, "selectedModifiers": [{"modifierId": "EM1-3"}]}, {"productId": "PZ", "productVariantId": "PZ-V-GR", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-15", "half": "full", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "full", "action": "add"}, {"pizzaIngredientId": "PZ-I-33", "half": "full", "action": "add"}], "selectedModifiers": [{"modifierId": "PZ-M1-8"}, {"modifierId": "PZ-M1-9"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "degollado 13 norte"}

      8. Pedido: "Me haces una ensalada de pollo grande con doble pollo pero que sea sin jitomate y sin chile morron, tambien quiero una pizza chica mitad adelita y mitad zapata con chorizo y chile jalapeño me lo envias a ramon corona 65 en una casa blanca"
      Ejecución: {"orderItems": [{"productId": "E", "productVariantId": "EV2", "quantity": 1, "selectedModifiers": [{"modifierId": "EM1-4"}], "comments": "sin jitomate y sin chile morrón"}, {"productId": "PZ", "productVariantId": "PZ-V-CH", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-7", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-4", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-27", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "ramon corona 65, casa blanca"}

      9. Pedido: "Me haces una orden y media de alitas bbq con extra salsa y una pizza grande con orilla rellena de mitad especial sin salchicha y la otra mitad malinche con chorizo, me lo envias a zaragoza 71 norte"
      Ejecución: {"orderItems": [{"productId": "A", "productVariantId": "AV1", "quantity": 1, "selectedModifiers": [{"modifierId": "AM1-3"}]}, {"productId": "A", "productVariantId": "AV2", "quantity": 1, "selectedModifiers": [{"modifierId": "AM1-3"}]}, {"productId": "PZ", "productVariantId": "PZ-V-GR", "selectedPizzaIngredients": [{"pizzaIngredientId": "PZ-I-1", "half": "left", "action": "add"}, {"pizzaIngredientId": "PZ-I-37", "half": "left", "action": "remove"}, {"pizzaIngredientId": "PZ-I-16", "half": "right", "action": "add"}, {"pizzaIngredientId": "PZ-I-25", "half": "right", "action": "add"}], "quantity": 1}], "orderType": "delivery", "deliveryInfo": "zaragoza 71 norte"}

      10. Pedido: "Voy a querer una media orden de papas a la francesa con queso y una media orden de alitas fritas con salsa bbq aparte y doble chile de aceite y una hamburguesa leñazo sin papas y sin jitomate ni lechuga y una michelada clara y un freppe de capichino me lo envias a felipe angeles 52"
      Ejecución: {"orderItems": [{"productId": "P", "productVariantId": "PV2", "quantity": 1}, {"productId": "A", "productVariantId": "AV6", "quantity": 1, "selectedModifiers": [{"modifierId": "AM1-7"}, {"modifierId": "AM1-8"}]}, {"productId": "H", "productVariantId": "HV6", "quantity": 1, "comments": "sin jitomate ni lechuga"}, {"productId": "MICH", "productVariantId": "MV1", "quantity": 1}, {"productId": "F", "productVariantId": "FV1", "quantity": 1}], "orderType": "delivery", "deliveryInfo": "felipe angeles 52"}`,
    };

    const messagesWithRelevantMenu = [
      ...relevantMessages,
      menuInstructions,
      menuAvailabilityMessage,
    ];

    console.log("Relevant messages with menu:", messagesWithRelevantMenu);

    const thread = await openai.beta.threads.create({
      messages: messagesWithRelevantMenu,
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
