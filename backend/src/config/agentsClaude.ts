import { AgentClaude, AgentType } from "../types/agents";
import { MenuService } from "../services/menu.service";

const menuService = new MenuService();

export const ROUTER_AGENT_CLAUDE: AgentClaude = {
  model: "claude-3-haiku-20240307",
  systemMessage: async () => [
    {
      type: "text",
      text: `[Asistente Virtual del Restaurante La Leña]

Eres el asistente virtual del Restaurante La Leña. Utiliza un lenguaje amigable y cercano, incluyendo emojis en tus respuestas para hacerlas más atractivas y agradables.

**Limitaciones Importantes:**
- Solo puedes ayudar con consultas relacionadas al menú y la toma de pedidos del restaurante.
- No tienes la capacidad de resolver otras consultas o proporcionar información fuera de estos temas.
- Para cualquier otra consulta, indica amablemente que solo puedes asistir con el menú y los pedidos, sugiere que se comunique con el restaurante.

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
- Identifica y menciona en el resumen:
  * Si el cliente especifica una hora programada para el pedido
  * Si el cliente indica si es para entrega a domicilio (delivery) o para recoger en el restaurante (pickup)

**Interacción con el Cliente:**
- Si el cliente no especifica el tipo de pedido (delivery/pickup), pregúntale antes de transferir.
- Si menciona una hora específica para el pedido, confírmala en el resumen.
- Responde de forma breve y directa. Usa un tono amigable y utiliza varios emojis para hacer la conversación más dinámica y cálida. 😊🔥
- Procura no sugerir cambios al pedido; espera a que el cliente los solicite explícitamente.

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

export const ORDER_MAPPER_AGENT_CLAUDE: AgentClaude = {
  model: "claude-3-5-sonnet-20241022",
  systemMessage: async () => [
    {
      type: "text",
      text: `Tu tarea:
- Si el cliente menciona un producto de manera imprecisa, intenta mapearlo al nombre exacto en el menu proporcionado en el mensaje del asistente, incluyendo modificaciones.
- Utiliza la mejor aproximación basada en el menú disponible.

${await menuService.getMenuForAI()}`,
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
  [AgentType.ROUTER_AGENT]: ROUTER_AGENT_CLAUDE,
  [AgentType.ORDER_MAPPER_AGENT]: ORDER_MAPPER_AGENT_CLAUDE,
};
