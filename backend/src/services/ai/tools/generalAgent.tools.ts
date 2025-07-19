/**
 * General Agent tool definitions
 * These tools are available to the general agent for handling various customer requests
 */

export function getGeneralAgentTools(): any[] {
  return [
    {
      name: "send_menu",
      description: "Envía el menú completo al usuario cuando lo solicite",
      parameters: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "get_business_hours",
      description: "Obtiene información completa del restaurante incluyendo ubicación, teléfonos y horarios",
      parameters: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "get_wait_times",
      description: "Obtiene los tiempos de espera estimados para recolección y entrega a domicilio",
      parameters: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "prepare_order_context",
      description: "Prepara el contexto para procesar una orden cuando el cliente quiere pedir algo",
      parameters: {
        type: "object",
        properties: {
          itemsSummary: {
            type: "string",
            description: "Lista de todos los artículos que el cliente mencionó (ej: '2 pizzas hawaianas grandes, 1 coca cola, papas fritas')"
          },
          orderType: {
            type: "string", 
            enum: ["DELIVERY", "TAKE_AWAY"],
            description: "Tipo de orden: DELIVERY (entrega a domicilio), TAKE_AWAY (para llevar/recoger)"
          }
        },
        required: ["itemsSummary", "orderType"]
      }
    },
    {
      name: "generate_address_update_link",
      description: "Genera un enlace seguro para que el cliente actualice o agregue una dirección de entrega",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Razón por la cual el cliente quiere actualizar la dirección"
          }
        }
      }
    },
    {
      name: "send_bot_instructions",
      description: "Envía las instrucciones completas de cómo usar el bot cuando el cliente lo solicite",
      parameters: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "get_menu_information",
      description: "Obtiene información específica sobre productos, ingredientes, precios o categorías del menú para responder preguntas del cliente.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "La pregunta o tema específico que el cliente consultó sobre el menú (ej: 'ingredientes de la pizza mexicana', 'tipos de hamburguesas', 'bebidas sin alcohol')"
          }
        },
        required: ["query"]
      }
    },
    {
      name: "reset_conversation",
      description: "Reinicia la conversación y borra el historial relevante cuando el cliente lo solicite",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  ];
}