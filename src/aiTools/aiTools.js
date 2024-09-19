const selectProductsTool = [
  {
    type: "function",
    function: {
      name: "select_products",
      strict: false,
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
                },
                productVariantId: {
                  type: ["string"],
                  description:
                    "ID de la variante del producto (solo si aplica).",
                },
                selectedPizzaIngredients: {
                  type: "array",
                  description:
                    "Lista de ingredientes seleccionados para la pizza, posicion y accion (solo si aplica).",
                  items: {
                    type: "object",
                    properties: {
                      pizzaIngredientId: {
                        type: "string",
                      },
                      position: {
                        type: "string",
                        enum: ["full", "left", "right"],
                        description:
                          "Posicion ingrediente ('full' para toda la pizza, 'left' para mitad izquierda, 'right' para mitad derecha). No se permite mezclar 'full' con 'left' o 'right'.",
                      },
                      action: {
                        type: "string",
                        enum: ["add", "remove"],
                        description:
                          "Acción a realizar con el ingrediente en la posición indicada.",
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
                      },
                    },
                    required: ["modifierId"],
                    additionalProperties: false,
                  },
                },
                comments: {
                  type: ["string"],
                  description:
                    "Observaciones que no estén definidas en los modificadores del producto.",
                },
                quantity: {
                  type: "integer",
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
              "Tipo de orden para entrega a domicilio o recolección en restaurante.",
          },
          deliveryInfo: {
            type: "string",
            description:
              "Dirección de entrega para pedidos a domicilio o nombre del cliente para recolección en restaurante.",
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
        "Preprocesa la orden del cliente en una lista estructurada de productos y detalles de entrega.",
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
                  description: "Cantidad y Descripción detallada del producto.",
                },
              },
              required: ["description"],
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
        },
        required: ["orderItems", "orderType", "deliveryInfo"],
        additionalProperties: false,
      },
    },
  },
];

module.exports = { selectProductsTool, preprocessOrderTool };
