const selectProductsTool = [
  {
    type: "function",
    function: {
      name: "select_products",
      description:
        "Crea los orderItems uno a uno y la preorden con los datos de entrega.",
      strict: false,
      parameters: {
        type: "object",
        properties: {
          orderItems: {
            type: "array",
            description: "Lista de orderItems mencionados.",
            items: {
              type: "object",
              properties: {
                productId: {
                  type: "string",
                  description: "ID del producto.",
                },
                selectedPizzaIngredients: {
                  type: "array",
                  description:
                    "Lista de ingredientes seleccionados para la pizza",
                  items: {
                    type: "object",
                    properties: {
                      pizzaIngredientId: {
                        type: "string",
                        description: "ID del ingrediente de la pizza.",
                      },
                      half: {
                        type: "string",
                        enum: ["full", "left", "right"],
                        description:
                          "Parte de la pizza donde se coloca el ingrediente ('full' para toda la pizza, 'left' para mitad izquierda, 'right' para mitad derecha).",
                      },
                      action: {
                        type: "string",
                        enum: ["add", "remove"],
                        description:
                          "Acción a realizar con el ingrediente: añadir o quitar de half correspondiente.",
                      },
                    },
                    required: ["pizzaIngredientId", "half", "action"],
                    additionalProperties: false,
                  },
                },
                selectedModifiers: {
                  type: "array",
                  description:
                    "Lista de modificadores seleccionados (si aplica).",
                  items: {
                    type: "object",
                    properties: {
                      modifierId: {
                        type: "string",
                        description: "ID del modificador.",
                      },
                    },
                    required: ["modifierId"],
                    additionalProperties: false,
                  },
                },
                comments: {
                  type: ["string"],
                  description:
                    "Añadir las observaciones que no pudieron ser definidas en los modificadores del producto.",
                },
                quantity: {
                  type: "integer",
                  description: "Cantidad del ítem.",
                },
              },
              required: ["productId", "quantity"],
              additionalProperties: false,
            },
          },
          orderType: {
            type: ["string"],
            enum: ["delivery", "pickup"],
            description:
              "Tipo de orden ('delivery' para entrega a domicilio, 'pickup' para recoger en restaurante).",
          },
          scheduledDeliveryTime: {
            type: "string",
            description:
              "Hora programada para el pedido (opcional, en formato de 24 horas).",
          },
        },
        required: ["orderItems", "orderType"],
        additionalProperties: false,
      },
    },
  },
];

const preprocessOrderTool = [
  {
    type: "function",
    function: {
      name: "preprocess_order",
      description:
        "Preprocesa la orden del cliente en una lista estructurada de productos y detalles de entrega, incluyendo un resumen de la conversación. Si la información de entrega es desconocida, se debe solicitar antes de procesar la orden.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          orderItems: {
            type: "array",
            description:
              "Lista de productos y cantidades solicitados por el cliente. Todos los productos y sus modificaciones deben estar disponibles en el menú actual.",
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
          conversationSummary: {
            type: "string",
            description:
              "Transcripción completa de la conversación entre el cliente y el asistente.",
          },
          scheduledDeliveryTime: {
            type: ["string", "null"],
            description:
              "Hora programada para el pedido (opcional, en formato de 24 horas).",
          },
        },
        required: [
          "orderItems",
          "orderType",
          "conversationSummary",
          "scheduledDeliveryTime",
        ],
        additionalProperties: false,
      },
    },
  },
];

const selectProductsToolClaude = {
  name: "select_products",
  description:
    "Crea los orderItems uno a uno y la preorden con los datos de entrega.",
  input_schema: {
    type: "object",
    properties: {
      orderItems: {
        type: "array",
        description: "Lista de orderItems mencionados.",
        items: {
          type: "object",
          properties: {
            productId: {
              type: "string",
              description: "ID del producto.",
            },
            selectedPizzaIngredients: {
              type: "array",
              description: "Lista de ingredientes seleccionados para la pizza",
              items: {
                type: "object",
                properties: {
                  pizzaIngredientId: {
                    type: "string",
                    description: "ID del ingrediente de la pizza.",
                  },
                  half: {
                    type: "string",
                    enum: ["full", "left", "right"],
                    description:
                      "Parte de la pizza donde se coloca el ingrediente ('full' para toda la pizza, 'left' para mitad izquierda, 'right' para mitad derecha).",
                  },
                  action: {
                    type: "string",
                    enum: ["add", "remove"],
                    description:
                      "Acción a realizar con el ingrediente: añadir o quitar de half correspondiente.",
                  },
                },
                required: ["pizzaIngredientId", "half", "action"],
              },
            },
            selectedModifiers: {
              type: "array",
              description: "Lista de modificadores seleccionados (si aplica).",
              items: {
                type: "object",
                properties: {
                  modifierId: {
                    type: "string",
                    description: "ID del modificador.",
                  },
                },
                required: ["modifierId"],
              },
            },
            comments: {
              type: "string",
              description:
                "Añadir las observaciones que no pudieron ser definidas en los modificadores del producto. El campo de comentarios debe usarse ÚNICAMENTE para observaciones simples o para indicar ingredientes que se deben retirar del producto. Nunca lo uses para agregar ingredientes o modificaciones que puedan generar un costo extra.",
            },
            quantity: {
              type: "integer",
              description: "Cantidad del ítem.",
            },
          },
          required: ["productId", "quantity"],
        },
      },
      orderType: {
        type: "string",
        enum: ["delivery", "pickup"],
        description:
          "Tipo de orden ('delivery' para entrega a domicilio, 'pickup' para recoger en restaurante).",
      },
      scheduledDeliveryTime: {
        type: "string",
        description:
          "Hora programada para el pedido (opcional, en formato de 24 horas).",
      },
    },
    required: ["orderItems", "orderType"],
  },
};
const sendMenuTool = [
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

export {
  selectProductsTool,
  preprocessOrderTool,
  selectProductsToolClaude,
  sendMenuTool,
};
