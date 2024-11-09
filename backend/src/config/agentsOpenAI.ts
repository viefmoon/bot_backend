import { AgentType, AgentOpenAI } from "../types/agents";
import { MenuService } from "../services/menu.service";

const menuService = new MenuService();

export const ROUTER_AGENT_OPENAI: AgentOpenAI = {
  model: "gpt-4o-mini",
  systemMessage: async () => ({
    role: "system",
    content: `
Eres el agente router, tu función es analizar la conversación completa entre el cliente y el asistente para transferir al agente apropiado.

**Reglas de transferencia:**
- Si la conversación está relacionada con realizar un pedido, modificar orden o menciona productos específicos → "ORDER_MAPPER_AGENT"
  - En este caso, debes extraer y estructurar los productos mencionados en el campo orderDetails
  - Cada producto debe incluir cantidad y descripción exacta mencionada por el usuario
- Si la conversación es sobre consultas del menú, precios, disponibilidad o información general → "QUERY_AGENT"

**Importante:**
- No respondas directamente al cliente
- Solo realiza la transferencia al agente correspondiente
- Para ORDER_MAPPER_AGENT, siempre incluye los detalles del pedido en orderDetails
`,
  }),
  tools: [
    {
      type: "function",
      function: {
        name: "route_to_agent",
        description: "Transfiere la conversación al agente especializado",
        parameters: {
          type: "object",
          properties: {
            targetAgent: {
              type: "string",
              enum: ["ORDER_MAPPER_AGENT", "QUERY_AGENT"],
              description: "Agente al que se transferirá la conversación",
            },
            orderDetails: {
              type: "array",
              description: "Array de productos solicitados (solo requerido para ORDER_MAPPER_AGENT)",
              items: {
                type: "object",
                properties: {
                  quantity: {
                    type: "integer",
                    description: "Cantidad del producto"
                  },
                  description: {
                    type: "string",
                    description: "Descripción detallada del producto"
                  }
                },
                required: ["quantity", "description"]
              }
            }
          },
          required: ["targetAgent"],
        },
      },
    },
  ],
  temperature: 0.5,
};

export const QUERY_AGENT_OPENAI: AgentOpenAI = {
  model: "gpt-4o-mini",
  systemMessage: async () => ({
    role: "system",
    content: `
Eres el asistente virtual del Restaurante La Leña. Usa un lenguaje amigable y cercano, incluyendo emojis en tus respuestas para hacerlas más atractivas.

**Limitaciones:**
- Solo ayudas con consultas sobre el menú y envío del menú
- No puedes resolver consultas sobre estados de pedidos, modificaciones, reservas, pagos, etc.

**Envío del Menú:**
- Envía el menú completo solo cuando el cliente lo solicite explícitamente usando \`send_menu\`.

**Interacción con el Cliente:**
- Responde de forma breve y directa.
- Usa un tono amigable y varios emojis para hacer la conversación dinámica.

${await menuService.getMenuForAI()}`,
  }),
  tools: [
    {
      type: "function",
      function: {
        name: "send_menu",
        description: "Envía el menú completo al cliente cuando lo solicita explícitamente.",
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

export const ORDER_MAPPER_AGENT_OPENAI: AgentOpenAI = {
  model: "gpt-4o-mini",
  systemMessage: async () => ({
    role: "system",
    content: `
Eres un agente especializado en mapear pedidos a los nombres exactos del menú.

**Objetivo Principal:**
- Convertir las solicitudes imprecisas de los clientes en referencias exactas del menú

**Reglas de Mapeo:**
1. Analiza detalladamente cada producto mencionado por el cliente
2. Compara con todas las opciones disponibles de el matchMenu obtenido de cada descripción
3. Identifica la mejor coincidencia basándote en:
   - Similitud fonética y textual
   - Ingredientes mencionados
   - Variantes y modificaciones solicitadas
   - Términos comunes o coloquiales utilizados por los clientes

**Proceso de Coincidencia:**
- Prioriza coincidencias exactas
- Considera sinónimos y variaciones regionales
- Evalúa coincidencias parciales por ingredientes
- Maneja personalizaciones y modificaciones especiales
- Procesa solicitudes de mitad y mitad en pizzas

**Importante:**
- Siempre incluye el nombre exacto del menú en la descripción
- Mantén todas las personalizaciones solicitadas por el cliente
- En caso de ambigüedad, selecciona la opción más popular o relevante
`,
  }),
  tools: [
    {
      type: "function",
      function: {
        name: "map_order_items",
        description: "Mapea los productos mencionados por el cliente a los nombres exactos del menú",
        parameters: {
          type: "object",
          properties: {
            orderItems: {
              type: "array",
              description: "Productos mapeados y sus cantidades",
              items: {
                type: "object",
                properties: {
                  quantity: {
                    type: "integer",
                    description: "Cantidad del producto (mínimo 1)"
                  },
                  description: {
                    type: "string",
                    description: "Nombre exacto del producto según el menú, incluyendo todas las modificaciones y personalizaciones"
                  }
                },
                required: ["description", "quantity"]
              }
            },
            orderType: {
              type: "string",
              enum: ["delivery", "pickup"],
              description: "Tipo de orden (default: 'delivery')"
            },
            scheduledDeliveryTime: {
              type: "string",
              description: "Hora programada de entrega en formato 24h (default: null para entrega inmediata)"
            }
          },
          required: ["orderItems", "orderType", "scheduledDeliveryTime"]
        }
      }
    }
  ],
  temperature: 0.5
};

export const AGENTS_OPENAI = {
  [AgentType.ROUTER_AGENT]: ROUTER_AGENT_OPENAI,
  [AgentType.QUERY_AGENT]: QUERY_AGENT_OPENAI,
  [AgentType.ORDER_MAPPER_AGENT]: ORDER_MAPPER_AGENT_OPENAI,
};
