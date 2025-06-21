/**
 * Order Agent tool definitions
 * Specialized tools for the order processing agent
 */

export function getOrderAgentTools(): any[] {
  return [
    {
      name: "map_order_items",
      description: "Mapear items del pedido con soporte completo para personalización de pizzas",
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
                  description: "ID de la variante (ej: 'PZ-V-1' para pizza grande)"
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
            description: "Tipo de orden: DELIVERY o TAKE_AWAY"
          },
          warnings: { 
            type: "string",
            description: "Advertencias o notas sobre el mapeo"
          }
        },
        required: ["orderItems", "orderType"]
      }
    }
  ];
}