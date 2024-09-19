const selectProductsTool = [
  {
    type: "function",
    function: {
      name: "select_products",
      description:
        "Selecciona los productos y crea una preorden con los datos de entrega.",
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
                productVariantId: {
                  type: ["string"],
                  description: "ID de la variante del producto (si aplica).",
                },
                selectedPizzaIngredients: {
                  type: "object",
                  description:
                    "Lista de ingredientes seleccionados para la pizza (si aplica). Se pueden personalizar las dos mitades de la pizza por separado.",
                  properties: {
                    halfOne: {
                      type: "object",
                      description:
                        "Ingredientes seleccionados para la mitad uno de la pizza.",
                      properties: {
                        addedIngredients: {
                          type: "array",
                          description:
                            "Ingredientes que se añaden a la mitad uno.",
                          items: {
                            type: "string",
                            description:
                              "ID del ingrediente de la pizza añadido.",
                          },
                        },
                        removedIngredients: {
                          type: "array",
                          description:
                            "Ingredientes que se quitan de la mitad uno.",
                          items: {
                            type: "string",
                            description:
                              "ID del ingrediente de la pizza quitado.",
                          },
                        },
                      },
                      additionalProperties: false,
                    },
                    halfTwo: {
                      type: "object",
                      description:
                        "Ingredientes seleccionados para la mitad dos de la pizza.",
                      properties: {
                        addedIngredients: {
                          type: "array",
                          description:
                            "Ingredientes que se añaden a la mitad dos.",
                          items: {
                            type: "string",
                            description:
                              "ID del ingrediente de la pizza añadido.",
                          },
                        },
                        removedIngredients: {
                          type: "array",
                          description:
                            "Ingredientes que se quitan de la mitad dos.",
                          items: {
                            type: "string",
                            description:
                              "ID del ingrediente de la pizza quitado.",
                          },
                        },
                      },
                      additionalProperties: false,
                    },
                    fullPizza: {
                      type: "object",
                      description:
                        "Ingredientes seleccionados para la pizza completa (si aplica).",
                      properties: {
                        addedIngredients: {
                          type: "array",
                          description:
                            "Ingredientes que se añaden a la pizza completa.",
                          items: {
                            type: "string",
                            description:
                              "ID del ingrediente de la pizza añadido.",
                          },
                        },
                        removedIngredients: {
                          type: "array",
                          description:
                            "Ingredientes que se quitan de la pizza completa.",
                          items: {
                            type: "string",
                            description:
                              "ID del ingrediente de la pizza quitado.",
                          },
                        },
                      },
                      additionalProperties: false,
                    },
                  },
                  oneOf: [
                    { required: ["halfOne", "halfTwo"] },
                    { required: ["fullPizza"] },
                  ],
                  additionalProperties: false,
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
                    "Observaciones que no estén definidas en los modificadores del producto.",
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
