const preprocessOrderToolGPT = [
  {
    type: "function",
    function: {
      name: "preprocess_order",
      description:
        "Preprocesa la orden del cliente en una lista estructurada de productos y detalles de entrega.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          orderItems: {
            type: "array",
            description: "Productos y cantidades solicitados por el cliente.",
            items: {
              type: "object",
              properties: {
                quantity: {
                  type: "integer",
                  description: "Cantidad del producto (minimo 1).",
                },
                description: {
                  type: "string",
                  description: "Descripción detallada del producto.",
                },
              },
              required: ["description", "quantity"],
              additionalProperties: false,
            },
          },
          orderType: {
            type: "string",
            enum: ["delivery", "pickup"],
            description:
              "Tipo de orden: entrega a domicilio o recolección en restaurante.",
          },
          scheduledDeliveryTime: {
            type: ["string", "null"],
            description:
              "Hora programada para el pedido (opcional, en formato de 24 horas).",
          },
        },
        required: ["orderItems", "orderType", "scheduledDeliveryTime"],
        additionalProperties: false,
      },
    },
  },
];

const sendMenuToolGPT = [
  {
    type: "function",
    function: {
      name: "send_menu",
      description:
        "Envía el menú completo al cliente cuando lo solicita explícitamente.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

const preprocessOrderToolClaude = {
  name: "preprocess_order",
  description: "Preprocesa la orden del cliente en una lista estructurada de productos y detalles de entrega.",
  input_schema: {
    type: "object" as const,
    properties: {
      orderItems: {
        type: "array",
        description: "Productos y cantidades solicitados por el cliente.",
        items: {
          type: "object",
          properties: {
            quantity: {
              type: "integer",
              description: "Cantidad del producto (mínimo 1)."
            },
            description: {
              type: "string",
              description: "Descripción detallada del producto."
            }
          },
          required: ["description", "quantity"],
          additionalProperties: false
        }
      },
      orderType: {
        type: "string",
        enum: ["delivery", "pickup"],
        description: "Tipo de orden: entrega a domicilio o recolección en restaurante."
      },
      scheduledDeliveryTime: {
        type: ["string", "null"],
        description: "Hora programada para el pedido (opcional, en formato de 24 horas)."
      }
    },
    required: ["orderItems", "orderType", "scheduledDeliveryTime"],
    additionalProperties: false
  }
};

const sendMenuToolClaude = {
  name: "send_menu",
  description: "Envía el menú completo al cliente cuando lo solicita explícitamente.",
  input_schema: {
    type: "object",
    properties: {},
    required: []
  }
};


export { 
  preprocessOrderToolGPT, 
  sendMenuToolGPT,
  preprocessOrderToolClaude,
  sendMenuToolClaude 
};
