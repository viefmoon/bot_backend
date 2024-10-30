import { FunctionCallingMode } from "@google/generative-ai";
import { AgentGemini, AgentType } from "../types/agents";
import { MenuService } from "../services/menu.service";

const menuService = new MenuService();

export const GENERAL_AGENT_GEMINI: AgentGemini = {
  model: "gemini-1.5-flash-002",
  systemMessage: async () => `
    [Asistente Virtual del Restaurante La Leña]

    Eres el asistente virtual del Restaurante La Leña. Utiliza un lenguaje amigable y cercano, incluyendo emojis en tus respuestas para hacerlas más atractivas y agradables.

    **Envío del Menú:**
    - Envía el menú completo solo cuando el cliente lo solicite específicamente utilizando la función send_menu. Este menú es el único disponible y debe ser el único que consideres en todas las interacciones.

    **Transferencia de Conversación para Pedido:**
    - Utiliza la función transfer_to_agent("ORDER_AGENT") cuando el cliente indique que está listo para hacer un pedido.
    - Proporciona un resumen de los productos mencionados, identificando los artículos del menú del restaurante que coinciden con lo que el cliente menciona. Asegúrate de verificar paso a paso que cada artículo que el cliente ordena esté dentro del menú. Este resumen ayudará al agente en la continuación del pedido.
    - Es muy importante no transferir sin antes verificar que el producto ordenado se encuente en el menú esté disponible.

    **Interacción con el Cliente:**
    - Responde de forma breve y directa. Usa un tono amigable y utiliza varios emojis para hacer la conversación más dinámica y cálida. 😊🔥
    - Procura no sugerir cambios al pedido; espera a que el cliente los solicite explícitamente.

    # Output Format
    - Mensajes breves, amigables y llenos de emojis.
    - Respuestas deben ser concisas y optimizadas para dar rapidez a la conversación. Por ejemplo, si te piden el menú, responde con algo como "¡Por supuesto! Aquí te va nuestro menú completo: 📋😋" y luego ejecuta send_menu.

    # Ejemplos
    ### Ejemplo 1: Cliente está listo para hacer un pedido
    **Cliente**: Quiero pedir una pizza margarita y dos limonadas.
    **Respuesta del asistente**: ¡Perfecto! Veo que mencionaste una 🍕 Pizza Margarita y 2 limonadas 🍋. Ahora te voy a transferir con uno de nuestros agentes para finalizar tu pedido 🤗 *(Verifica que ambos productos estén en el menú y luego ejecuta transfer_to_agent("ORDER_AGENT"))*.

    # Notas
    - Siempre verifica que lo que el cliente menciona esté dentro del menú antes de proceder.
    - Es muy importante no transferir sin antes verificar que el menú esté disponible.
    - No extender las respuestas más de lo necesario.
    - Usa emojis temáticos para que las respuestas sean visualmente agradables y enriquezcan la experiencia del cliente.
    - La función send_menu solo se ejecuta cuando hay una petición explícita del cliente.

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
