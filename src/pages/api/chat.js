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

    console.log("Productos encontrados:", JSON.stringify(products));

    if (!products || products.length === 0) {
      console.error("No se encontraron productos");
      return { error: "No se encontraron productos en la base de datos" };
    }

    const menuSimplificado = {
      entradas: [],
      comida: [],
      bebidas: [],
      cocteleria: [],
    };

    products.forEach((producto) => {
      const productoInfo = {
        id: producto.id,
        //nombre: producto.name,
        activo: producto.Availability?.available || false,
      };

      // Agregar variantes
      if (producto.productVariants?.length > 0) {
        productoInfo.variantes = producto.productVariants.map((v) => ({
          id: v.id,
          //nombre: v.name,
          activo: v.Availability?.available || false,
        }));
      }

      // Agregar modificadores
      if (producto.modifierTypes?.length > 0) {
        productoInfo.tiposModificadores = producto.modifierTypes.map((mt) => ({
          id: mt.id,
          //nombre: mt.name,
          activo: mt.Availability?.available || false,
          modificadores: mt.modifiers?.map((m) => ({
            id: m.id,
            //nombre: m.name,
            activo: m.Availability?.available || false,
          })),
        }));
      }

      // Agregar ingredientes de pizza
      if (producto.pizzaIngredients?.length > 0) {
        productoInfo.ingredientesPizza = producto.pizzaIngredients.map((i) => ({
          id: i.id,
          //nombre: i.name,
          activo: i.Availability?.available || false,
        }));
      }

      menuSimplificado[producto.category].push(productoInfo);
    });

    // Eliminar categorías vacías
    Object.keys(menuSimplificado).forEach((categoria) => {
      if (menuSimplificado[categoria].length === 0) {
        delete menuSimplificado[categoria];
      }
    });

    return { "Menu Disponible": menuSimplificado };
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
  const { relevantMessages, conversationId } = req;

  try {
    // Obtener la disponibilidad del menú
    const menuAvailability = await getMenuAvailability();

    // Crear un nuevo mensaje con la disponibilidad del menú
    const menuAvailabilityMessage = {
      role: "assistant",
      content: JSON.stringify(menuAvailability),
    };

    // Añadir el mensaje de disponibilidad del menú al principio de los mensajes
    const messagesWithMenu = [menuAvailabilityMessage, ...relevantMessages];

    console.log("Relevant messages with menu:", messagesWithMenu);

    const thread = await openai.beta.threads.create({
      messages: messagesWithMenu,
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
