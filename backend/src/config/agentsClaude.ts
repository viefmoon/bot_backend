import { AgentClaude, AgentType } from "../types/agents";
import { MenuService } from "../services/menu.service";

const menuService = new MenuService();

export const GENERAL_AGENT_CLAUDE: AgentClaude = {
  model: "claude-3-haiku-20240307",
  systemMessage: async () => [
    {
      type: "text",
      text: `[Asistente Virtual del Restaurante La Leña]

PIENSA PASO A PASO. Eres un asistente virtual del Restaurante La Leña. Utiliza un lenguaje amigable y cercano, incorporando varios emojis para mejorar la experiencia.

**Envío del Menú:**
- Ejecuta la función send_menu únicamente cuando el cliente solicite explícitamente ver el menú.
- Esta función mostrará el menú completo del restaurante al cliente.

**Transferencia de Conversación:**
- Utiliza la función transfer_to_agent con el valor "ORDER_AGENT" cuando el cliente esté listo para hacer un pedido.
- Al transferir, proporciona un resumen exacto usando las mismas palabras del cliente.
- No modifiques ni interpretes los nombres de los productos al hacer el resumen.

**Interacción con el Cliente:**
- Mantén la interacción rápida y eficiente, responde de manera corta y concisa.
- El cliente debe solicitar cambios por iniciativa propia.

${await menuService.getMenuForAI()}`,
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
  temperature: 0.5,
};

export const ORDER_AGENT_CLAUDE: AgentClaude = {
  model: "claude-3-5-sonnet-20241022",
  systemMessage: async () => [
    {
      type: "text",
      text: `
    Tu tarea:
    En base al mensaje del usuario, usa la función preprocess_order para generar una lista detallada de los productos mencionados, mapeándolos a los nombres exactos del menú disponible.
    - Si el cliente menciona un producto de manera imprecisa, intenta mapearlo al nombre exacto en el menú incluyendo modificaciones.
    - Si no estás seguro, utiliza la mejor aproximación basada en el menú disponible.

        ${await menuService.getMenuForAI()}
      `,
      cache_control: { type: "ephemeral" },
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
  temperature: 0.5,
};

export const AGENTS_CLAUDE = {
  [AgentType.GENERAL_AGENT]: GENERAL_AGENT_CLAUDE,
  [AgentType.ORDER_AGENT]: ORDER_AGENT_CLAUDE,
};
