import { FunctionCallingMode } from "@google/generative-ai";
import { AgentGemini, AgentType } from "../types/agents";
import { getFullMenu } from "../services/menu";

export const ROUTER_AGENT_GEMINI: AgentGemini = {
  //model: "gemini-1.5-flash-002",
  model: "gemini-2.0-flash-exp",
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
                      description:
                        "Descripción completa del producto incluyendo personalizaciones",
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
  toolConfig: {
    functionCallingConfig: {
      mode: FunctionCallingMode.ANY,
      allowedFunctionNames: ["route_to_agent"],
    },
  },
};

export const ORDER_MAPPER_AGENT_GEMINI: AgentGemini = {
  //model: "gemini-1.5-flash-002",
  model: "gemini-2.0-flash-exp",
  systemMessage: async () => {
    const menu = await getFullMenu();
    return `Eres un asistente para mapear pedidos de comida.
    
MENU COMPLETO:
${JSON.stringify(menu, null, 2)}

IMPORTANTE: Solo puedes mapear productos que existen en el menú.

AGRUPACIÓN DE PIZZAS:
- Si un cliente pide pizzas con mitades diferentes (ejemplo: "2 pizzas mitad hawaiana mitad pepperoni"), 
  debes agruparlas como UN SOLO item con cantidad correspondiente

REGLAS DE MAPEO:
1. Para cada producto, verifica que existe en el menú
2. Mapea las variantes correctas (tamaños, tipos)
3. Identifica y mapea modificadores disponibles
4. Para pizzas, mapea ingredientes específicos

FORMATO DE RESPUESTA:
Debes llamar a confirm_order con la siguiente estructura...`;
  },
  tools: [
    {
      function_declarations: [
        {
          name: "confirm_order",
          description: "Confirma el pedido mapeado",
          parameters: {
            type: "object",
            properties: {
              orderItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    productId: { type: "string" },
                    quantity: { type: "integer" },
                    productVariant: {
                      type: "object",
                      properties: {
                        productVariantId: { type: "string" }
                      }
                    },
                    selectedModifiers: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          modifierId: { type: "string" }
                        }
                      }
                    },
                    selectedPizzaIngredients: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          pizzaIngredientId: { type: "string" },
                          half: { type: "string", enum: ["left", "right", "full"] },
                          action: { type: "string", enum: ["add", "remove"] }
                        }
                      }
                    },
                    comments: { type: "string" }
                  }
                }
              },
              orderType: { type: "string", enum: ["delivery", "pickup"] },
              scheduledDeliveryTime: { type: "string" }
            },
            required: ["orderItems"]
          }
        }
      ]
    }
  ],
  toolConfig: {
    functionCallingConfig: {
      mode: FunctionCallingMode.ANY,
      allowedFunctionNames: ["confirm_order"]
    }
  }
};

export const QUERY_AGENT_GEMINI: AgentGemini = {
  //model: "gemini-1.5-flash-002",
  model: "gemini-2.0-flash-exp",
  systemMessage: async () => {
    const menu = await getFullMenu();
    return `Eres un asistente amigable del restaurante.

MENU DISPONIBLE:
${JSON.stringify(menu, null, 2)}

HORARIOS:
- Martes a Sábado: ${process.env.OPENING_HOURS_TUES_SAT} - ${process.env.CLOSING_HOURS_TUES_SAT}
- Domingo: ${process.env.OPENING_HOURS_SUN} - ${process.env.CLOSING_HOURS_SUN}
- Lunes: CERRADO

Responde las consultas sobre el menú, precios, ingredientes y disponibilidad.
Sé amigable y conciso.`;
  },
  tools: [] // Query agent doesn't need tools
};