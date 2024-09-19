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
                  type: "array",
                  description:
                    "Lista de ingredientes seleccionados para la pizza (si aplica). Debe incluir al menos un ingrediente y se pueden personalizar las dos mitades de la pizza por separado.",
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
        "Preprocesa la orden del cliente en una lista estructurada de productos y detalles de entrega. \
Para mejorar la precisión, sigue las siguientes directrices:\n\
- Mapea los productos mencionados a los nombres exactos en el menú disponible.\n\
- Asegúrate de que las cantidades de los productos sean siempre números enteros.\n\
- Si un producto mencionado no coincide exactamente con un nombre en el menú, elige el más cercano o similar.\n\
- Si no estás seguro de un producto o cantidad, omítelo en lugar de hacer suposiciones.",
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
                  description:
                    "Cantidad y descripción detallada del producto. Para productos de tipo pizza, ten en cuenta que se pueden preparar por mitades o completa:\n\
  - Usa 'full' para ingredientes en toda la pizza.\n\
  - Usa 'left' para ingredientes en la mitad izquierda.\n\
  - Usa 'right' para ingredientes en la mitad derecha.\n\
- Lista los ingredientes de la pizza de la siguiente manera:\n\
  - Cada ingrediente debe tener un 'pizzaIngredientId' (string), 'half' ('full', 'left', o 'right'), y 'action' ('add' o 'remove').\n\
  - Ejemplo: { \"pizzaIngredientId\": \"123\", \"half\": \"left\", \"action\": \"add\" } para añadir un ingrediente en la mitad izquierda.\n\
  - Si se menciona quitar un ingrediente, usa 'action': 'remove'.\n\
- Asegúrate de que cada ingrediente mencionado para una pizza se ajuste a este formato.",
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
