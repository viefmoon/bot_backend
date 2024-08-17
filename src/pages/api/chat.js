const OpenAI = require("openai");
const axios = require("axios");
const { Order } = require("../../models");
const { sequelize } = require("../../lib/db");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const validateApiKey = (req, res) => {
  const authorizationHeader = req.headers["authorization"];
  if (!authorizationHeader) {
    return res.status(401).json({
      status: "error",
      message: "Authorization header is missing",
    });
  }
  const tokenParts = authorizationHeader.split(" ");

  if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
    return res.status(401).json({
      status: "error",
      message: "Invalid Authorization header format",
    });
  }
  const apiKeyStr = tokenParts[1]; // Extract the API key from the Bearer token
  if (apiKeyStr !== process.env.BEARER_TOKEN) {
    return res.status(401).json({
      status: "error",
      message: "Incorrect Bearer token",
    });
  }
};
// Añadir esta función después de findClientId
async function getCustomerData(clientId) {
  try {
    const response = await axios.get(
      `${process.env.BASE_URL}/api/get_customer_data?client_id=${clientId}`
    );
    return response.data;
  } catch (error) {
    console.error(
      "El cliente no existe en la base de datos, aun no ha realizado un pedido:",
      error
    );
    return null;
  }
}

async function createOrder(toolCall, clientId) {
  const { orderType, orderItems, phoneNumber, deliveryAddress, pickupName } =
    JSON.parse(toolCall.function.arguments);

  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/api/create_order`,
      {
        action: "create",
        orderType,
        orderItems,
        phoneNumber,
        deliveryAddress,
        customerName: pickupName,
        clientId,
      }
    );

    const orderResult = response.data;
    console.log("Order result:", orderResult);

    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify(orderResult),
    };
  } catch (error) {
    console.error(
      "Error creating order:",
      error.response ? error.response.data : error.message
    );
    return {
      tool_call_id: toolCall.id,
      output: JSON.stringify({
        error: error.response
          ? error.response.data.error
          : "Failed to create order",
        details: error.message,
      }),
    };
  }
}

async function modifyOrder(toolCall, clientId) {
  const {
    dailyOrderNumber,
    orderType,
    orderItems,
    phoneNumber,
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
        phoneNumber,
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

function filterRelevantMessages(messages) {
  const keywordsUser = ["olvida lo anterior", "nuevo pedido"];
  const keywordsAssistant = [
    "Tu pedido ha sido generado",
    "Gracias por tu orden",
  ];
  const MAX_MESSAGES = 20;

  let relevantMessages = [];
  let foundKeyword = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    if (!foundKeyword && relevantMessages.length < MAX_MESSAGES) {
      if (
        message.role === "user" &&
        keywordsUser.some((keyword) =>
          message.content.toLowerCase().includes(keyword)
        )
      ) {
        relevantMessages.unshift(message);
        foundKeyword = true;
      } else if (
        message.role === "assistant" &&
        keywordsAssistant.some((keyword) => message.content.includes(keyword))
      ) {
        foundKeyword = true;
      } else {
        relevantMessages.unshift(message);
      }
    }

    if (foundKeyword) break;
  }

  return relevantMessages.length > 0
    ? relevantMessages
    : messages.slice(-MAX_MESSAGES);
}

async function getMenuAvailability() {
  try {
    const response = await axios.get(`${process.env.BASE_URL}/api/menu`);
    const products = response.data;

    const availability = {};
    products.forEach((product) => {
      availability[product.code] = {
        disponible: product.available,
        nombre: product.name,
      };
    });

    return { availability };
  } catch (error) {
    console.error("Error fetching menu availability:", error);
    return { error: "Failed to fetch menu availability" };
  }
}

// Añade esta función después de getMenuAvailability
function getMenu() {
  const menuString = `
🍽️ ¡Este es nuestro menú! 🍽️

🥗 Entradas:
1. 🍗 Alitas
   - BBQ (orden completa $135 / media $70)
   - Picosas (orden completa $135 / media $70)
   - Fritas (orden completa $135 / media $70)
   - Mixtas BBQ y picosas ($135)
   Todas las alitas vienen acompañadas de chile de aceite.

2. 🍟 Papas:
   - A la Francesa (orden completa $90 / media $50)
   - Gajos (orden completa $100 / media $60)
   - Mixtas francesa y gajos ($100)
   🧀 Opción: Con queso y sin queso sin costo.
   Todas las papas vienen acompañadas de aderezo.

3. 🧀 Dedos de Queso ($90)
🍕 Pizzas:
Tamaños: Grande ($240), Mediana ($190), Chica ($140)
Opción de orilla rellena: Grande (+$30), Mediana (+$30), Chica (+$20)
Variedades:
1. Especial: Pepperoni, Salchicha, Jamón, Salami, Chile morrón
2. Carnes Frías: Pepperoni, Salchicha, Jamón, Salami
3. Carranza: Chorizo, Jamón, Chile jalapeño, Jitomate
4. Zapata: Salami, Jamón, Champiñón
5. Villa: Chorizo, Tocino, Piña, Chile jalapeño
6. Margarita: 3 Quesos, Jitomate, Albahaca
7. Adelita: Jamón, Piña, Arándano
8. Hawaiana: Jamón, Piña
9. Mexicana: Chorizo, Cebolla, Chile jalapeño, Jitomate
10. Rivera: Elote, Champiñón, Chile morrón
11. Kahlo: Calabaza, Elote, Champiñón, Jitomate, Chile morrón
12. Lupita: Carne molida, Tocino, Cebolla, Chile morrón
13. Pepperoni
14. La Leña: Tocino, Pierna, Chorizo, Carne molida (+$20)
15. La María: Pollo BBQ, Piña, Chile jalapeño (+$20)
16. Malinche: 3 Quesos, Queso de cabra, Champiñón, Jamón, Chile seco, Albahaca (+$20)
17. Philadelphia: Jamon, Queso philadelphia, Chile , Albahaca (+$20)
18. Personalizada con hasta 3 ingredientes de los disponibles sin costo extra.
-Ingrediente extra (+$10)
Opción de pizza mitad y mitad: Se puede armar una pizza mitad y mitad con dos variedades diferentes, sin costo adicional.
Todas las pizzas vienen acompañadas de chile de aceite y aderezo.

🍔 Hamburguesas:
Todas nuestras hamburguesas incluyen: cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema y mostaza.

1. Tradicional: Carne de res, tocino, queso amarillo, queso asadero ($85)
2. Especial: Carne de res, tocino, pierna, queso amarillo, queso asadero ($95)
3. Hawaiana: Carne de res, tocino, piña, jamón, queso amarillo, queso asadero ($95)
4. Pollo: Pechuga de pollo a la plancha, tocino, queso amarillo, queso asadero ($100)
5. BBQ: Carne de res, salsa BBQ, tocino, queso amarillo, queso asadero, cebolla guisada ($100)
6. Lenazo: Doble carne de sirlón, tocino, queso amarillo, queso asadero ($110)
7. Cubana: Carne de res, tocino, pierna, salchicha, jamón, queso amarillo ($100)
Todas nuestras hamburguesas vienen acompañadas de aderezo y salsa catsup.

🥔 Opción de hamburguesas con papas: 
   - Francesa (+$10)
   - Gajos (+$15)
   - Mixtas (+$15)

🥗 Ensaladas:
- De Pollo: 
  Chica ($90) / Grande ($120)
- De Jamón: 
  Chica ($80) / Grande ($100)

Incluyen: Pollo a la plancha o jamón, chile morrón, elote, lechuga, jitomate, zanahoria, queso parmesano, aderezo, betabel crujiente

➕ Extras disponibles:
   - Con vinagreta (sin costo adicional)
   - Doble pollo (+$15)
   - Con jamón (+$10)
   - Con queso gouda (+$15)

🥤 Bebidas:
- Agua de horchata (1 Litro) ($35)
- Limonada (1 Litro) ($35)
- Limonada Mineral (1 Litro) ($35)
- Refrescos 500ml: Coca Cola, 7up, Mirinda, Sangría, Agua Mineral, Squirt ($30 c/u)
- Sangría Preparada: Con limón y sal ($35)
- Micheladas: Clara u oscura ($80)
- Café Caliente: Americano ($45), Capuchino ($45), Chocolate ($50), Mocachino ($45), Latte Vainilla ($45), Latte Capuchino ($45)
- Frappés ($70): Capuchino, Coco, Caramelo, Cajeta, Mocaccino, Galleta, Bombón
- Frappés especiales ($85): Rompope, Mazapán, Magnum

🍹 Coctelería:
1. Copa de vino tinto ($90)
2. Sangría con vino ($80)
3. Vampiro ($80)
4. Gin de Maracuyá ($90)
5. Margarita ($85)
6. Ruso Blanco ($85)
7. Palo santo ($80)
8. Gin de pepino ($90)
9. Mojito ($100)
10. Piña colada ($75)
11. Piñada (sin alcohol) ($70)
12. Conga ($75)
13. Destornillador ($75)
14. Paloma ($80)
15. Carajillo ($90)
16. Tinto de verano ($90)
17. Clericot ($80)

¡Buen provecho! 😋
  `;

  return { menu: menuString.trim() };
}

export default async function handler(req, res) {
  await sequelize.sync({ alter: true });
  if (req.method === "POST") {
    validateApiKey(req, res);
    const { messages, conversationId } = req.body;

    try {
      const filteredMessages = messages.filter(
        (message) => message.role !== "system" && message.content.trim() !== ""
      );
      const relevantMessages = filterRelevantMessages(filteredMessages);

      const menuAvailability = await getMenuAvailability(); // Obtener disponibilidad del menú de la base de datos

      //Añadir disponibilidad del menú a los mensajes relevantes
      relevantMessages.push({
        role: "assistant",
        content: `Disponibilidad actual del menú: ${JSON.stringify(
          menuAvailability.availability
        )}`,
      });

      console.log("Relevant messages:", relevantMessages);
      const thread = await openai.beta.threads.create({
        messages: relevantMessages,
      });

      const QUEUE_TIMEOUT = 15000; // 15 segundos
      const startTime = Date.now();

      let run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: process.env.ASSISTANT_ID,
      });

      let shouldDeleteConversation = false; // Añadir esta variable

      while (
        ["queued", "in_progress", "requires_action"].includes(run.status)
      ) {
        if (run.status === "requires_action") {
          const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
          console.log("Tool calls:", toolCalls);

          const toolOutputs = await Promise.all(
            toolCalls.map(async (toolCall) => {
              const clientId = conversationId.split(":")[1];
              console.log("Client ID:", clientId);
              let result;
              switch (toolCall.function.name) {
                case "get_customer_data":
                  const customerData = await getCustomerData(clientId);
                  return {
                    tool_call_id: toolCall.id,
                    output: JSON.stringify(customerData),
                  };
                case "create_order":
                  result = await createOrder(toolCall, clientId);
                  shouldDeleteConversation = true; // Activar el borrado
                  return result;
                case "modify_order":
                  result = await modifyOrder(toolCall, clientId);
                  shouldDeleteConversation = true; // Activar el borrado
                  return result;
                case "cancel_order":
                  result = await cancelOrder(toolCall, clientId);
                  shouldDeleteConversation = true; // Activar el borrado
                  return result;
                case "get_order_details":
                  const { daily_order_number } = JSON.parse(
                    toolCall.function.arguments
                  );
                  const orderDetails = await getOrderDetails(
                    daily_order_number,
                    clientId
                  );
                  return {
                    tool_call_id: toolCall.id,
                    output: JSON.stringify(orderDetails),
                  };
                case "get_menu":
                  const menu = getMenu();
                  return {
                    tool_call_id: toolCall.id,
                    output: JSON.stringify(menu),
                  };
                case "calculate_order_total":
                  const { orderItems } = JSON.parse(
                    toolCall.function.arguments
                  );
                  result = await calculateOrderTotal(orderItems);
                  return {
                    tool_call_id: toolCall.id,
                    output: JSON.stringify(result),
                  };

                default:
                  return {
                    tool_call_id: toolCall.id,
                    output: JSON.stringify({ error: "Unknown function" }),
                  };
              }
            })
          );

          run = await openai.beta.threads.runs.submitToolOutputs(
            thread.id,
            run.id,
            { tool_outputs: toolOutputs }
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        }
        console.log("Run status:", run.status);

        // Verificar si se ha excedido el tiempo límite
        if (Date.now() - startTime > QUEUE_TIMEOUT && run.status === "queued") {
          console.log(
            "La solicitud ha excedido el tiempo límite en estado 'queued'"
          );
          return res.status(504).json({
            error:
              "No se puede completar la solicitud en este momento. Por favor, inténtelo de nuevo más tarde.",
          });
        }
      }

      if (run.status === "completed") {
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastAssistantMessage = messages.data.find(
          (message) => message.role === "assistant"
        );
        if (lastAssistantMessage && lastAssistantMessage.content[0].text) {
          let text = lastAssistantMessage.content[0].text.value;
          console.log("Assistant response:", text);

          res.status(200).send(text);

          // Mover la lógica de borrado después de enviar la respuesta
          if (shouldDeleteConversation) {
            const clientId = conversationId.split(":")[1];
            try {
              await deleteConversation(clientId);
              console.log(`Conversación borrada para el cliente: ${clientId}`);
            } catch (error) {
              console.error(
                `Error al borrar la conversación para el cliente ${clientId}:`,
                error
              );
            }
          }
        } else {
          console.log("Run failed with status:", run.status);
          res
            .status(500)
            .json({ error: "Failed to complete the conversation" });
        }
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Failed to fetch data from OpenAI" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function deleteConversation(clientId) {
  try {
    const deleteResponse = await axios.delete(
      `${process.env.BASE_URL}/api/delete_conversation`,
      {
        params: { clientId },
      }
    );
    console.log("Conversación borrada:", deleteResponse.data);
  } catch (error) {
    console.error(
      "Error al borrar la conversación:",
      error.response ? error.response.data : error.message
    );
  }
}

async function calculateOrderTotal(orderItems) {
  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/api/create_order`,
      {
        action: "calculatePrice",
        orderItems: orderItems,
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error al calcular el total del pedido:", error);
    return { error: "Error al calcular el total del pedido" };
  }
}
