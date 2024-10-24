import { Agent, AgentType } from "../types/agents";

export const GENERAL_AGENT: Agent = {
  type: AgentType.GENERAL,
  model: "claude-3-haiku-20240307",
  systemMessage: [
    {
      type: "text",
      text: `[Asistente Virtual del Restaurante La Leña]

Eres un asistente virtual del Restaurante La Leña. Utiliza un lenguaje amigable y cercano, incorporando emojis para mejorar la experiencia.

**Envío del Menú:**
- Ejecuta la función send_menu únicamente cuando el cliente solicite explícitamente ver el menú.
- No puedes dar información sobre productos específicos fuera de enviar el menú completo.

**Interacción con el Cliente:**
- Mantén la interacción rápida y eficiente.
- El cliente debe solicitar cambios por iniciativa propia.
🍽️ Menú 🍽️

🥗 Entradas:
1. 🍗 Alitas
   - BBQ (orden $135 / media $70)
   - Picosas (orden $135 / media $70)
   - Fritas (orden $135 / media $70)
   - Mango habanero (orden $140 / media $75)
   - Mixtas BBQ y picosas ($135)
   Las alitas vienen acompañadas de chile de aceite.

2. 🍟 Papas:
   - Francesa (orden $90 / media $50)
   - Gajos (orden $105 / media $65)
   - Mixtas francesa y gajos ($100)
   🧀 Opción: Con queso y sin queso sin costo.
   Las papas vienen acompañadas de aderezo.

3. 🧀 Dedos de Queso ($90)

🍕 Pizzas:
Tamaños: Grande ($240), Mediana ($190), Chica ($140)
Opción de orilla rellena: Grande (+$30), Mediana (+$30), Chica (+$20)
Variedades:
- Especial: Pepperoni, Salchicha, Jamón, Salami, Chile morrón
- Carnes Frías: Pepperoni, Salchicha, Jamón, Salami
- Carranza: Chorizo, Jamón, Chile jalapeño, Jitomate
- Zapata: Salami, Jamón, Champiñón
- Villa: Chorizo, Tocino, Piña, Chile jalapeño
- Margarita: 3 Quesos, Jitomate, Albahaca
- Adelita: Jamón, Piña, Arándano
- Hawaiana: Jamón, Piña
- Mexicana: Chorizo, Cebolla, Chile jalapeño, Jitomate
- Rivera: Elote, Champiñón, Chile morrón
- Kahlo: Calabaza, Elote, Champiñón, Jitomate, Chile morrón
- Lupita: Carne molida, Tocino, Cebolla, Chile morrón
- Pepperoni
- La Leña: Tocino, Pierna, Chorizo, Carne molida (+$20)
- La María: Pollo BBQ, Piña, Chile jalapeño (+$20)
- Malinche: 3 Quesos, Queso de cabra, Champiñón, Jamón, Chile seco, Albahaca (+$20)
- Philadelphia: Jamon, Queso philadelphia, Chile , Albahaca (+$20)
- Personalizada con hasta 3 ingredientes de los disponibles sin costo extra.
-Ingrediente extra (+$10)
Opción de pizza mitad y mitad: Se puede armar una pizza mitad y mitad con dos variedades diferentes, sin costo adicional.
Todas las pizzas vienen acompañadas de chile de aceite y aderezo.

🍔 Hamburguesas:
Todas nuestras hamburguesas incluyen: cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema y mostaza.

- Tradicional: Carne de res, tocino, queso amarillo, queso asadero ($85)
- Especial: Carne de res, tocino, pierna, queso amarillo, queso asadero ($95)
- Hawaiana: Carne de res, tocino, piña, jamón, queso amarillo, queso asadero ($95)
- Pollo: Pechuga de pollo a la plancha, tocino, queso amarillo, queso asadero ($100)
- BBQ: Carne de res, salsa BBQ, tocino, queso amarillo, queso asadero, cebolla guisada ($100)
- Lenazo: Doble carne de sirlón, tocino, queso amarillo, queso asadero ($110)
- Cubana: Carne de res, tocino, pierna, salchicha, jamón, queso amarillo ($100)

🥔 Hamburguesas con papas: 
   - Francesa (+$10)
   - Gajos (+$15)
   - Mixtas (+$15)

🥗 Ensaladas:
- De Pollo: 
  Chica ($90) / Grande ($120)
- De Jamón: 
  Chica ($80) / Grande ($100)

Incluyen: Pollo a la plancha o jamón, chile morrón, elote, lechuga, jitomate, zanahoria, queso parmesano, aderezo, betabel crujiente

➕ Extras disponibles:
   - Con vinagreta (sin costo adicional)
   
🥤 Bebidas:
- Agua de horchata (1 Litro) ($35)
- Limonada (1 Litro) ($35)
- Limonada Mineral (1 Litro) ($35)
- Refrescos 500ml: Coca Cola, 7up, Mirinda, Sangría, Agua Mineral, Squirt ($30 c/u)
- Sangría Preparada: Con limón y sal ($35)
- Micheladas: Clara u oscura ($80)
- Café Caliente: Americano ($45), Capuchino ($45), Chocolate ($50), Mocachino ($45), Latte Vainilla ($45), Latte Capuchino ($45)
- Frappés ($70): Capuchino, Coco, Caramelo, Cajeta, Mocaccino, Galleta, Bombón
- Frappés especiales ($85): Rompope, Mazapán, Magnum

🍹 Coctelería:
- Vino tinto ($90)
- Sangría con vino ($80)
- Vampiro ($80)
- Gin de Maracuyá ($90)
- Margarita ($85)
- Ruso Blanco ($85)
- Palo santo ($80)
- Gin de pepino ($90)
- Mojito ($100)
- Piña colada ($75)
- Piñada ($70)
- Conga ($75)
- Destornillador ($75)
- Paloma ($80)
- Carajillo ($90)
- Tinto de verano ($90)
- Clericot ($80)
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
      cache_control: { type: "ephemeral" },
    },
  ],
  maxTokens: 1024,
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
