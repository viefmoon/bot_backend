import { Agent, AgentType } from "../types/agents";

export const GENERAL_AGENT: Agent = {
  type: AgentType.GENERAL,
  model: "claude-3-haiku-20240307",
  systemMessage: [
    {
      type: "text",
      text: `
        Eres un asistente virtual del Restaurante La Leña. Utiliza un lenguaje amigable y cercano, incorporando emojis para mejorar la experiencia.
        
        Tus responsabilidades son:
        1. Responder preguntas generales sobre el restaurante
        2. Enviar el menú cuando lo soliciten explicitamente (utilizando la herramienta send_menu)
        3. Detectar cuando el cliente quiere hacer un pedido
        
        Si detectas que el cliente quiere hacer un pedido (menciona productos específicos o intención de ordenar), 
        debes transferir la conversación al agente de pedidos usando la función transfer_to_agent.
      `,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `
        **Menú:**

        **Entradas:**
        
        - **Alitas**
          - Sabores: BBQ, Picosas, Fritas, Mango Habanero, Mixtas BBQ y Picosas
          - Tamaños: Orden, Media
        - **Ordenes de Papas**
          - Tipos: Francesa, Gajos, Mixtas Francesa y Gajos
          - Tamaños: Orden, Media
          - Opciones: Con queso o sin queso
        - **Dedos de Queso**
        
        **Pizzas:**
        
        - **Tamaños:** Grande, Mediana, Chica, y con orilla rellena de queso
        - **Variedades:** Especial, Carnes Frías, Carranza, Zapata, Villa, Margarita, Adelita, Hawaiana, Mexicana, Rivera, Kahlo, Lupita, Pepperoni, La Leña, La María, Malinche, Philadelphia
        - **Opciones:** Ingrediente extra, Mitad y mitad
        
        **Hamburguesas:**
        
        - **Opciones:** Con papas francesas, Con papas gajos, Con papas mixtas y las papas pueden ir gratinadas
        - **Variedades:** Tradicional, Especial, Hawaiana, Pollo, BBQ, Lenazo, Cubana
        
        **Ensaladas:**
        
        - **Tipos:** De Pollo, De Jamón
        - **Tamaños:** Chica, Grande
        
        **Bebidas:**
        
        - **Aguas Frescas:** Agua de horchata, Limonada, Limonada Mineral
        - **Refrescos:** Coca Cola, 7up, Mirinda, Sangría, Agua Mineral, Squirt
        - **Otras:** Sangría Preparada, Micheladas
        - **Café Caliente:** Americano, Capuchino, Chocolate, Mocachino, Latte Vainilla, Latte Capuchino
        - **Frappés:** Capuchino, Coco, Caramelo, Cajeta, Mocaccino, Galleta, Bombón, Rompope, Mazapán, Magnum
        
        **Coctelería:**
        
        Vino tinto, Sangría con vino, Vampiro, Gin de Maracuyá, Margarita, Ruso Blanco, Palo santo, Gin de pepino, Mojito, Piña colada, Piñada, Conga, Destornillador, Paloma, Carajillo, Tinto de verano, Clericot
      `,
      cache_control: { type: "ephemeral" },
    },
  ],
  tools: [
    {
      name: "transfer_to_agent",
      description:
        "Transfiere la conversación a otro agente especializado con un resumen del pedido",
      input_schema: {
        type: "object",
        properties: {
          targetAgent: {
            type: "string",
            enum: Object.values(AgentType),
          },
          orderSummary: {
            type: "string",
            description:
              "Resumen conciso del pedido del cliente, incluyendo productos y modificaciones",
          },
        },
        required: ["targetAgent", "orderSummary"],
      },
    },
    {
      name: "send_menu",
      description:
        "Envía el menú completo al cliente cuando lo solicita explícitamente.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  ],
  maxTokens: 4096,
};

export const ORDER_AGENT: Agent = {
  type: AgentType.ORDER,
  model: "claude-3-5-sonnet-20241022",
  systemMessage: [
    {
      type: "text",
      text: `
        [Asistente de Pedidos - La Leña]
        // Add your specific instructions for the order agent here
      `,
      cache_control: { type: "ephemeral" },
    },
  ],
  tools: [
    {
      name: "preprocess_order",
      description:
        "Generar una lista detallada de los productos mencionados por el cliente.",
      input_schema: {
        type: "object",
        properties: {
          orderItems: {
            type: "array",
            description: "Productos y cantidades.",
            items: {
              type: "object",
              properties: {
                quantity: {
                  type: "integer",
                  description: "Cantidad del producto (mínimo 1).",
                },
                description: {
                  type: "string",
                  description:
                    "Descripción detallada del producto, mapeándolos a los nombres exactos del menú, incluyendo modificaciones, ingredientes extra, etc. o mitad y mitad de pizza si el cliente las menciona",
                },
              },
              required: ["description", "quantity"],
            },
          },
          orderType: {
            type: "string",
            enum: ["delivery", "pickup"],
            description:
              "Tipo de orden: entrega a domicilio o recolección en restaurante, por defecto, asume que el orderType es 'delivery'.",
          },
          scheduledDeliveryTime: {
            type: ["string", "null"],
            description:
              "Hora programada para el pedido (opcional, en formato de 24 horas), por defecto, asume que la scheduledDeliveryTime es null (entrega inmediata).",
          },
        },
        required: ["orderItems", "orderType", "scheduledDeliveryTime"],
      },
    },
  ],
  maxTokens: 4096,
};

export const AGENTS = {
  [AgentType.GENERAL]: GENERAL_AGENT,
  [AgentType.ORDER]: ORDER_AGENT,
};
