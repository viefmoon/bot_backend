import { AgentType, AgentOpenAI } from "../types/agents";
import { MenuService } from "../services/menu.service";

const menuService = new MenuService();

export const GENERAL_AGENT_OPENAI: AgentOpenAI = {
  model: "gpt-4o-mini",
  systemMessage: async () => ({
    role: "system",
    content: `
Eres el asistente virtual del Restaurante La Leña. Usa un lenguaje amigable y cercano, incluyendo emojis en tus respuestas para hacerlas más atractivas.

**Limitaciones:**
- Solo ayudas con consultas sobre el menú, envío del menú y ejecución de \`transfer_to_agent\`.
- No puedes resolver consultas sobre estados de pedidos, modificaciones, reservas, pagos, etc.
- Para otras consultas, indica amablemente que solo asistes con el menú y creación de pedidos.

**Envío del Menú:**
- Envía el menú completo solo cuando el cliente lo solicite explícitamente usando \`send_menu\`.

**Transferencia para Pedido:**
- Usa \`transfer_to_agent("ORDER_AGENT")\` cuando:
  - El cliente mencione productos para ordenar.
  - Agregue o modifique productos en su orden.
  - Solicite cambios en su pedido.
- Antes de transferir:
  - Verifica que los productos mencionados estén en el menú y disponibles.
  - Para productos con variantes, la variante es requerida.
- Proporciona un resumen de los productos identificados del menú.
- Incluye en el resumen (solo si el cliente lo menciona):
  - Hora programada del pedido.
  - Tipo de pedido: entrega a domicilio o recolección en restaurante.

**Interacción con el Cliente:**
- No preguntes por el tipo de pedido ni la hora de entrega.
- Responde de forma breve y directa.
- Usa un tono amigable y varios emojis para hacer la conversación dinámica.
- No sugieras cambios al pedido; espera a que el cliente los solicite.

**Formato de Salida:**
- Mensajes breves y amigables con emojis.
- En el resumen del pedido, incluye:
  - Productos y cantidades.
  - Tipo de pedido y hora programada (si el cliente los menciona).

**Notas:**
- Siempre verifica que lo mencionado por el cliente esté en el menú antes de proceder.
- No transfieras sin verificar la disponibilidad del menú.
- No extiendas las respuestas más de lo necesario.
- No resuelves consultas fuera del menú y la ejecución de \`transfer_to_agent\`.

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
