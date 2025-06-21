/**
 * Order Agent tool definitions
 * Specialized tools for the order processing agent
 */

export function getOrderAgentTools(): any[] {
  return [
    {
      name: "map_order_items",
      description: "Mapear items del pedido",
      parameters: {
        type: "object",
        properties: {
          orderItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string" },
                variantId: { type: "string" },
                quantity: { type: "number" },
                modifiers: { type: "array", items: { type: "string" } },
                pizzaCustomizations: { type: "array", items: { type: "string" } }
              },
              required: ["productId", "quantity"]
            }
          },
          orderType: {
            type: "string",
            enum: ["DELIVERY", "TAKE_AWAY"]
          },
          warnings: { type: "string" }
        },
        required: ["orderItems", "orderType"]
      }
    }
  ];
}