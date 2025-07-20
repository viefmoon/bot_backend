/**
 * Agent tool definitions
 * Contains all tools for customer interactions and order processing
 */

export function getAgentTools(): any[] {
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
      name: "send_bot_instructions",
      description: "Envía las instrucciones completas de cómo usar el bot cuando el cliente lo solicite",
      parameters: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "get_menu_information",
      description: "Obtiene información específica sobre productos, ingredientes, precios o categorías del menú para responder preguntas del cliente. IMPORTANTE: También debes usar esta herramienta ANTES de procesar cualquier pedido para verificar que todos los productos existen y obtener sus IDs.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "La pregunta o tema específico que el cliente consultó sobre el menú, O la lista completa de productos mencionados en un pedido (ej: 'ingredientes de la pizza mexicana', 'tipos de hamburguesas', '2 pizzas hawaianas grandes coca cola')"
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
    },
    {
      name: "map_order_items",
      description: "Mapea los items del pedido del cliente y CREA UNA PRE-ORDEN que se mostrará al cliente con botones físicos de ACEPTAR o RECHAZAR. IMPORTANTE: Esta herramienta NO confirma el pedido, solo genera un resumen que el cliente debe aprobar manualmente. Los datos de entrega (dirección, nombre) se obtienen automáticamente del número de WhatsApp del cliente. Solo usa esta herramienta DESPUÉS de verificar con get_menu_information que todos los productos existen.",
      parameters: {
        type: "object",
        properties: {
          orderItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { 
                  type: "string",
                  description: "ID del producto (ej: 'PZ' para pizza)"
                },
                variantId: { 
                  type: "string",
                  description: "ID de la variante (ej: 'PZ-V-1' para pizza grande). OBLIGATORIO si el producto tiene variantes"
                },
                quantity: { 
                  type: "number",
                  description: "Cantidad del producto"
                },
                modifiers: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Array de IDs de modificadores generales"
                },
                pizzaCustomizations: {
                  type: "array",
                  description: "Personalizaciones de pizza con estructura detallada",
                  items: {
                    type: "object",
                    properties: {
                      customizationId: {
                        type: "string",
                        description: "ID de la personalización (ej: 'PZ-I-1' para Adelita, 'PZ-I-22' para Champiñón)"
                      },
                      half: {
                        type: "string",
                        enum: ["FULL", "HALF_1", "HALF_2"],
                        description: "En qué parte de la pizza: FULL (completa), HALF_1 (primera mitad), HALF_2 (segunda mitad)"
                      },
                      action: {
                        type: "string",
                        enum: ["ADD", "REMOVE"],
                        description: "ADD para agregar, REMOVE para quitar ingrediente"
                      }
                    },
                    required: ["customizationId", "half", "action"]
                  }
                }
              },
              required: ["productId", "quantity"]
            },
            description: `EJEMPLOS DE PIZZAS:
            
1. "Pizza Hawaiana grande":
   pizzaCustomizations: [{
     customizationId: "PZ-I-5", // FLAVOR Hawaiana
     half: "FULL",
     action: "ADD"
   }]

2. "Pizza mitad Hawaiana mitad Pepperoni":
   pizzaCustomizations: [
     { customizationId: "PZ-I-5", half: "HALF_1", action: "ADD" },
     { customizationId: "PZ-I-13", half: "HALF_2", action: "ADD" }
   ]

3. "Pizza Hawaiana con champiñones extra":
   pizzaCustomizations: [
     { customizationId: "PZ-I-5", half: "FULL", action: "ADD" },
     { customizationId: "PZ-I-22", half: "FULL", action: "ADD" }
   ]

4. "Pizza Mexicana sin chile jalapeño":
   pizzaCustomizations: [
     { customizationId: "PZ-I-12", half: "FULL", action: "ADD" },
     { customizationId: "PZ-I-23", half: "FULL", action: "REMOVE" }
   ]

5. "Pizza con pepperoni y champiñones" (sin sabor base):
   pizzaCustomizations: [
     { customizationId: "PZ-I-40", half: "FULL", action: "ADD" },
     { customizationId: "PZ-I-22", half: "FULL", action: "ADD" }
   ]`
          },
          orderType: {
            type: "string",
            enum: ["DELIVERY", "TAKE_AWAY"],
            description: "Tipo de orden: DELIVERY (entrega a domicilio) o TAKE_AWAY (para llevar/recoger)"
          },
          warnings: { 
            type: "string",
            description: "Advertencias o notas sobre el mapeo si hay productos no encontrados o ambigüedades"
          }
        },
        required: ["orderItems", "orderType"]
      }
    }
  ];
}