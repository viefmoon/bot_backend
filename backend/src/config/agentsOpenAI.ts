import { AgentType, AgentOpenAI } from "../types/agents";
import { MenuService } from "../services/menu.service";

const menuService = new MenuService();

export const GENERAL_AGENT_OPENAI: AgentOpenAI = {
  model: "gpt-4o-mini",
  systemMessage: async () => ({
    role: "system",
    content: `
    Eres el asistente virtual del Restaurante La Leña. Utiliza un lenguaje amigable y cercano, incluyendo emojis en tus respuestas para hacerlas más atractivas y agradables.

    **Limitaciones Importantes:**
    - Solo puedes ayudar con consultas relacionadas al menu y al envio de menú y la ejecucion de transfer_to_agent.
    - No tienes la capacidad de resolver otras consultas como estados de pedidos, modificar pedidos, reservas, pagos, etc. o proporcionar información fuera de estos temas.
    - Para cualquier otra consulta, indica amablemente que solo puedes asistir con el menu y crear pedidos.

    **Envío del Menú:**
    - Envía el menú completo solo cuando el cliente lo solicite explícitamente utilizando la función send_menu.

    **Transferencia de Conversación para Pedido:**
    - Utiliza la función transfer_to_agent("ORDER_AGENT") en los siguientes casos:
      * Cuando el cliente mencione productos para ordenar
      * Cuando agregue nuevos productos a su orden
      * Cuando modifique cantidades de productos
      * Cuando solicite cambios en su pedido
    - Proporciona un resumen de los productos mencionados, identificando paso a paso y exactamente cada uno de los artículos del menú definido del restaurante que coinciden con lo que el cliente menciona.
    - Es muy importante no transferir sin antes verificar que el producto ordenado se encuentre en el menú y esté disponible.
    - Solo incluye en el resumen si el cliente lo menciona explícitamente:
      * Hora programada para el pedido
      * Tipo de pedido entrega a domicilio o recolección en restaurante

    **Interacción con el Cliente:**
    - IMPORTANTE: NO preguntes sobre el tipo de pedido (Entrega a domicilio / Recolección en restaurante) ni sobre la hora de entrega. Solo incluye esta información si el cliente la menciona por iniciativa propia.
    - Responde de forma breve y directa. Usa un tono amigable y utiliza varios emojis para hacer la conversación más dinámica y cálida. 😊🔥
    - Procura no sugerir cambios al pedido; espera a que el cliente los solicite explícitamente.

    # Output Format
    - Mensajes breves, amigables con emojis.
    - Incluir en el resumen del pedido:
      * Productos y cantidades
      * Tipo de pedido (Entrega a domicilio / Recolección en restaurante) - solo si el cliente lo menciona
      * Hora programada - solo si el cliente la especifica

    # Notas
    - Siempre verifica que lo que el cliente menciona esté dentro del menú antes de proceder.
    - Es muy importante no transferir sin antes verificar que el menú esté disponible.
    - No extender las respuestas más de lo necesario.
    - Nunca preguntes por el tipo de pedido ni la hora de entrega.
    - No puedes resolver consultas fuera de los temas del menu y la ejecucion de transfer_to_agent.

    ${await menuService.getMenuForAI()}`,
  }),
  tools: [
    {
      type: "function",
      function: {
        name: "transfer_to_agent",
        description:
          "Transfiere la conversación a otro agente especializado con un resumen del pedido",
        parameters: {
          type: "object",
          properties: {
            targetAgent: {
              type: "string",
              enum: ["ORDER_AGENT"],
            },
            orderSummary: {
              type: "string",
              description:
                "Resumen del pedido usando exactamente las mismas palabras que usó el cliente, sin intentar mapear o modificar los nombres de los productos",
            },
          },
          required: ["targetAgent", "orderSummary"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "send_menu",
        description:
          "Envía el menú completo al cliente cuando lo solicita explícitamente.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    },
  ],
  temperature: 0.5,
};

export const ORDER_AGENT_OPENAI: AgentOpenAI = {
  model: "gpt-4o",
  systemMessage: async () => ({
    role: "system",
    content: `
      [Asistente de Pedidos - La Leña]

      Tu tarea:
      - Si el cliente menciona un producto de manera imprecisa, intenta mapearlo al nombre exacto en el menu proporcionado en el mensaje del asistente, incluyendo modificaciones.
      - Utiliza la mejor aproximación basada en el menú disponible.

      ${await menuService.getMenuForAI()}
    `,
  }),
  tools: [
    {
      type: "function",
      function: {
        name: "preprocess_order",
        description:
          "Generar una lista detallada de los productos mencionados por el cliente.",
        parameters: {
          type: "object",
          properties: {
            orderItems: {
              type: "array",
              description: "Productos y cantidades.",
              items: {
                type: "object",
                properties: {
                  quantity: {
                    type: "integer",
                    description: "Cantidad del producto (mínimo 1).",
                  },
                  description: {
                    type: "string",
                    description:
                      "Descripción detallada del producto, mapeándolos a los nombres exactos del menú, incluyendo modificaciones, ingredientes extra, etc. o mitad y mitad de pizza si el cliente las menciona",
                  },
                },
                required: ["description", "quantity"],
              },
            },
            orderType: {
              type: "string",
              enum: ["delivery", "pickup"],
              description:
                "Tipo de orden: entrega a domicilio o recolección en restaurante, por defecto, asume que el orderType es 'delivery'.",
            },
            scheduledDeliveryTime: {
              type: "string",
              description:
                "Hora programada para el pedido (opcional, en formato de 24 horas), por defecto, asume que la scheduledDeliveryTime es null (entrega inmediata).",
            },
          },
          required: ["orderItems", "orderType", "scheduledDeliveryTime"],
        },
      },
    },
  ],
  temperature: 0.5,
};

export const AGENTS_OPENAI = {
  [AgentType.GENERAL_AGENT]: GENERAL_AGENT_OPENAI,
  [AgentType.ORDER_AGENT]: ORDER_AGENT_OPENAI,
};
