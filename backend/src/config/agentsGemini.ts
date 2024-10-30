import { FunctionCallingMode } from "@google/generative-ai";
import { AgentGemini, AgentType } from "../types/agents";
import { MenuService } from "../services/menu.service";

const menuService = new MenuService();

export const GENERAL_AGENT_GEMINI: AgentGemini = {
  model: "gemini-1.5-flash-002",
  systemMessage: async () => `
    Eres el asistente virtual del Restaurante La Leña. Utiliza un lenguaje amigable y cercano, incluyendo emojis en tus respuestas para hacerlas más atractivas y agradables.

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
      * Tipo de pedido (delivery/pickup)

    **Interacción con el Cliente:**
    - IMPORTANTE: NO preguntes sobre el tipo de pedido (delivery/pickup) ni sobre la hora de entrega. Solo incluye esta información si el cliente la menciona por iniciativa propia.
    - Responde de forma breve y directa. Usa un tono amigable y utiliza varios emojis para hacer la conversación más dinámica y cálida. 😊🔥
    - Procura no sugerir cambios al pedido; espera a que el cliente los solicite explícitamente.

    # Output Format
    - Mensajes breves, amigables con emojis.
    - Incluir en el resumen del pedido:
      * Productos y cantidades
      * Tipo de pedido (delivery/pickup) - solo si el cliente lo menciona
      * Hora programada - solo si el cliente la especifica

    # Notas
    - Siempre verifica que lo que el cliente menciona esté dentro del menú antes de proceder.
    - Es muy importante no transferir sin antes verificar que el menú esté disponible.
    - No extender las respuestas más de lo necesario.
    - Nunca preguntes por el tipo de pedido ni la hora de entrega.

    ${await menuService.getMenuForAI()}
  `,
  tools: [
    {
      function_declarations: [
        {
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
                  "Resumen detallado del pedido que incluye: 1) Las palabras exactas que usó el cliente al ordenar, y 2) El mapeo sugerido de cada producto mencionado con los nombres exactos del menú, incluyendo cantidades",
              },
            },
            required: ["targetAgent", "orderSummary"],
          },
        },
        {
          name: "send_menu",
          description:
            "Envía el menú completo solo cuando el cliente lo solicita explícitamente.",
          parameters: {
            type: "object",
            properties: {
              sendMenu: {
                type: "boolean",
                description:
                  "Campo opcional para cumplir con el esquema, no es necesario enviarlo.",
              },
            },
            required: [],
          },
        },
      ],
    },
  ],
  allowedFunctionNames: ["transfer_to_agent", "send_menu"],
  functionCallingMode: FunctionCallingMode.AUTO,
};

export const ORDER_AGENT_GEMINI: AgentGemini = {
  model: "gemini-1.5-flash-002",
  //model: "gemini-1.5-exp-0827",
  //model: "gemini-1.5-flash-8b",
  systemMessage: `
    Tu tarea:
    - Si el cliente menciona un producto de manera imprecisa, intenta mapearlo al nombre exacto en el menu proporcionado en el mensaje del asistente, incluyendo modificaciones.
    - Utiliza la mejor aproximación basada en el menú disponible.
  `,
  tools: [
    {
      function_declarations: [
        {
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
                        "Descripción detallada del producto, mapeándolos a los nombres exactos del menú proporcionado en el mensaje del asistente, incluyendo modificaciones, ingredientes extra, etc. o mitad y mitad de pizza si el cliente las menciona",
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
      ],
    },
  ],
  allowedFunctionNames: ["preprocess_order"],
  functionCallingMode: FunctionCallingMode.ANY,
};

export const AGENTS_GEMINI = {
  [AgentType.GENERAL_AGENT]: GENERAL_AGENT_GEMINI,
  [AgentType.ORDER_AGENT]: ORDER_AGENT_GEMINI,
};
