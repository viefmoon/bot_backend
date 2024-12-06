import { FunctionCallingMode } from "@google/generative-ai";
import { AgentGemini, AgentType } from "../types/agents";
import { MenuService } from "../services/menu.service";

const menuService = new MenuService();

export const ROUTER_AGENT_GEMINI: AgentGemini = {
  //model: "gemini-1.5-flash-002",
  model: "gemini-exp-1206",
  systemMessage: async () => `
IMPORTANTE: Considera ÚNICAMENTE el último mensaje del usuario para determinar el agente apropiado.

- Si la conversación está relacionada con realizar un pedido, modificar orden o menciona productos específicos → "ORDER_MAPPER_AGENT"
  - Primero, analiza detalladamente el mensaje para identificar:
    * Productos individuales y sus cantidades
    * Pizzas con opciones de mitad y mitad
    * Personalizaciones específicas para cada producto
    * Modificaciones o extras solicitados
  - Luego, extrae y estructura los productos en el campo orderDetails
  - Cada producto debe incluir:
    * Cantidad exacta
    * Descripción completa incluyendo todas las personalizaciones
    * Para pizzas divididas: especificar claramente cada mitad
- Si la conversación es sobre consultas del menú, precios, disponibilidad o información general → "QUERY_AGENT"
`,
  tools: [
    {
      function_declarations: [
        {
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
                description:
                  "Array de productos solicitados (solo requerido para ORDER_MAPPER_AGENT)",
                items: {
                  type: "object",
                  properties: {
                    quantity: {
                      type: "integer",
                      description: "Cantidad del producto",
                    },
                    description: {
                      type: "string",
                      description: "Descripción detallada del producto",
                    },
                  },
                  required: ["quantity", "description"],
                },
              },
            },
            required: ["targetAgent"],
          },
        },
      ],
    },
  ],
  allowedFunctionNames: ["route_to_agent"],
  functionCallingMode: FunctionCallingMode.ANY,
};

export const QUERY_AGENT_GEMINI: AgentGemini = {
  //model: "gemini-1.5-flash-002",
  model: "gemini-exp-1206",
  systemMessage: async () => `
Eres el asistente virtual del Restaurante La Leña. Usa un lenguaje amigable y cercano, incluyendo emojis en tus respuestas para hacerlas más atractivas.

**Limitaciones:**
- Solo ayudas con consultas sobre el menú y envío del menú
- No puedes resolver consultas sobre estados de pedidos, modificaciones, reservas, pagos, etc.

**Envío del Menú:**
- Envía el menú completo solo cuando el cliente lo solicite explícitamente.

**Interacción con el Cliente:**
- Responde de forma breve y directa.
- Usa un tono amigable y varios emojis para hacer la conversación dinámica.

${await menuService.getMenuForAI()}`,
  tools: [
    {
      function_declarations: [
        {
          name: "send_menu",
          description: "Envía el menú completo al cliente",
          parameters: {
            type: "object",
            properties: {
              confirmed: {
                type: "boolean",
                description: "Confirma el envío del menú",
              },
            },
            required: ["confirmed"],
          },
        },
      ],
    },
  ],
  allowedFunctionNames: ["send_menu"],
  functionCallingMode: FunctionCallingMode.AUTO,
};

export const ORDER_MAPPER_AGENT_GEMINI: AgentGemini = {
  //model: "gemini-1.5-flash-002",
  model: "gemini-exp-1206",
  systemMessage: async () => `
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
  tools: [
    {
      function_declarations: [
        {
          name: "map_order_items",
          description:
            "Mapea los productos mencionados por el cliente a los nombres exactos del menú",
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
                      description: "Cantidad del producto (mínimo 1)",
                    },
                    description: {
                      type: "string",
                      description:
                        "Nombre exacto del producto según el menú, incluyendo todas las modificaciones y personalizaciones",
                    },
                  },
                  required: ["description", "quantity"],
                },
              },
              orderType: {
                type: "string",
                enum: ["delivery", "pickup"],
                description: "Tipo de orden (default: 'delivery')",
              },
              scheduledDeliveryTime: {
                type: "string",
                description:
                  "Hora programada de entrega en formato 24h (default: null para entrega inmediata)",
              },
            },
            required: ["orderItems", "orderType", "scheduledDeliveryTime"],
          },
        },
      ],
    },
  ],
  allowedFunctionNames: ["map_order_items"],
  functionCallingMode: FunctionCallingMode.ANY,
};

export const AGENTS_GEMINI = {
  [AgentType.ROUTER_AGENT]: ROUTER_AGENT_GEMINI,
  [AgentType.QUERY_AGENT]: QUERY_AGENT_GEMINI,
  [AgentType.ORDER_MAPPER_AGENT]: ORDER_MAPPER_AGENT_GEMINI,
};
