import { Agent, AgentType } from "../types/agents";
import { getMenuForAI } from "../utils/menuUtils";

export const GENERAL_AGENT: Agent = {
  type: AgentType.GENERAL,
  model: "claude-3-haiku-20240307",
  systemMessage: async () => [
    {
      type: "text",
      text: `[Asistente Virtual del Restaurante La Leña]

Eres un asistente virtual del Restaurante La Leña. Utiliza un lenguaje amigable y cercano, incorporando emojis para mejorar la experiencia.

**Envío del Menú:**
- Ejecuta la función send_menu únicamente cuando el cliente solicite explícitamente ver el menú.
- No puedes dar información sobre productos específicos fuera de enviar el menú completo.

**Interacción con el Cliente:**
- Mantén la interacción rápida y eficiente.
- El cliente debe solicitar cambios por iniciativa propia.

${await getMenuForAI()}`,
      cache_control: { type: "ephemeral" },
    },
  ],
  tools: [
    {
      name: "transfer_to_agent",
      description:
        "Transfiere la conversación a otro agente especializado con un resumen del pedido",
      input_schema: {
        type: "object",
        properties: {
          targetAgent: {
            type: "string",
            enum: Object.values(AgentType),
          },
          orderSummary: {
            type: "string",
            description:
              "Resumen conciso del pedido del cliente, incluyendo productos y modificaciones",
          },
        },
        required: ["targetAgent", "orderSummary"],
      },
    },
    {
      name: "send_menu",
      description:
        "Envía el menú completo al cliente cuando lo solicita explícitamente.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
      cache_control: { type: "ephemeral" },
    },
  ],
  maxTokens: 1024,
};

export const ORDER_AGENT: Agent = {
  type: AgentType.ORDER,
  model: "claude-3-5-sonnet-20241022",
  systemMessage: [
    {
      type: "text",
      text: `
        [Asistente de Pedidos - La Leña]
        // Add your specific instructions for the order agent here
      `,
    },
  ],
  tools: [
    {
      name: "preprocess_order",
      description:
        "Generar una lista detallada de los productos mencionados por el cliente.",
      input_schema: {
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
            type: ["string", "null"],
            description:
              "Hora programada para el pedido (opcional, en formato de 24 horas), por defecto, asume que la scheduledDeliveryTime es null (entrega inmediata).",
          },
        },
        required: ["orderItems", "orderType", "scheduledDeliveryTime"],
      },
    },
  ],
  maxTokens: 4096,
};

export const AGENTS = {
  [AgentType.GENERAL]: GENERAL_AGENT,
  [AgentType.ORDER]: ORDER_AGENT,
};
