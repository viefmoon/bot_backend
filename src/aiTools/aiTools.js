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
                    "Lista de ingredientes seleccionados para la pizza. Incluye los ingredientes base de la pizza entera o cada mitad y cualquier ingrediente adicional especificado para una mitad en particular o la pizza entera. IMPORTANTE: Los ingredientes adicionales SIEMPRE deben asignarse a la mitad correspondiente ('left' o 'right'), NUNCA a 'full' cuando se trata de una pizza con mitades diferentes.",
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
                          "Parte de la pizza donde se coloca el ingrediente ('full' para toda la pizza, 'left' para mitad izquierda, 'right' para mitad derecha). Está restringido fusionar 'left' o 'right' con 'full'.",
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
          deliveryInfo: {
            type: "string",
            description:
              "Dirección de entrega para pedidos a domicilio o Nombre del cliente para recolección en restaurante.",
          },
        },
        required: ["orderItems", "orderType", "deliveryInfo"],
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
        "Preprocesa la orden del cliente en una lista estructurada de productos y detalles de entrega, incluyendo un resumen de la conversación.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          orderItems: {
            type: "array",
            description: "Lista de productos solicitados por el cliente.",
            items: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description: "Descripción detallada del producto.",
                },
                quantity: {
                  type: "integer",
                  description: "Cantidad del producto.",
                },
              },
              required: ["description", "quantity"],
              additionalProperties: false,
            },
          },
          deliveryInfo: {
            type: "string",
            description:
              "Dirección de entrega para pedidos a domicilio o nombre de cliente para recolección en el restaurante.",
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
        },
        required: [
          "orderItems",
          "orderType",
          "deliveryInfo",
          "conversationSummary",
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
              description:
                "Lista de ingredientes seleccionados para la pizza. Incluye los ingredientes base de la pizza entera o cada mitad y cualquier ingrediente adicional especificado para una mitad en particular o la pizza entera. IMPORTANTE: Los ingredientes adicionales SIEMPRE deben asignarse a la mitad correspondiente ('left' o 'right'), NUNCA a 'full' cuando se trata de una pizza con mitades diferentes.",
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
                      "Parte de la pizza donde se coloca el ingrediente ('full' para toda la pizza, 'left' para mitad izquierda, 'right' para mitad derecha). Está restringido fusionar 'left' o 'right' con 'full'.",
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
                "Añadir las observaciones que no pudieron ser definidas en los modificadores del producto.",
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
      deliveryInfo: {
        type: "string",
        description:
          "Dirección de entrega para pedidos a domicilio o Nombre del cliente para recolección en restaurante.",
      },
    },
    required: ["orderItems", "orderType", "deliveryInfo"],
  },
};

module.exports = {
  selectProductsTool,
  preprocessOrderTool,
  selectProductsToolClaude,
};
