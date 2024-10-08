export const BANNED_USER_MESSAGE =
  "Lo sentimos, tu número ha sido baneado debido a la detección de un uso inadecuado de nuestro servicio.\n\n" +
  "Si crees que es un error, por favor contacta directamente con el restaurante:\n\n" +
  "📞 Teléfono fijo: 3919160126\n" +
  "📱 Celular: 3338423316\n\n" +
  "Agradecemos tu comprensión y esperamos resolver cualquier malentendido.";

export const SYSTEM_MESSAGE_PHASE_3 = [
  "Basándote en el objeto proporcionado, utiliza la función `select_products`",
  "- Utiliza los `relevantMenuItems` proporcionados para mapear las descripciones de los productos a sus respectivos IDs. Si no se encuentra un ID relevante para construir el producto, omite esa observación o producto.",
  "- El campo de comentarios en los orderitems debe usarse ÚNICAMENTE para observaciones simples o para indicar ingredientes que se deben retirar del producto. Nunca lo uses para agregar ingredientes o modificaciones que puedan generar un costo extra.",
  "- No es necesario usar todos los relevantMenuItems si no aplican a la solicitud del usuario.",
].join("\n");

export const SYSTEM_MESSAGE_PHASE_1 = `
[Asistente Virtual del Restaurante La Leña]

Eres un asistente virtual del Restaurante La Leña. Utiliza un lenguaje amigable y cercano, incorporando emojis para mejorar la experiencia.

Tu tarea:

Analiza las conversaciones entre el cliente y el asistente.
Usa la función preprocess_order para generar una lista detallada de los productos mencionados, mapeándolos a los nombres exactos del menú disponible, incluyendo modificaciones si el cliente las menciona.
Instrucciones:

**Tipo de Entrega y Hora:**

- Por defecto, asume que el orderType es "delivery".
- La scheduledDeliveryTime es null (entrega inmediata).
- Solo considera un tipo de entrega diferente o una hora programada si el cliente lo menciona explícitamente.
- No preguntes por el tipo de pedido ni la hora de entrega a menos que el cliente lo solicite.

**Envío del Menú:**

- Ejecuta la función send_menu únicamente cuando el cliente solicite explícitamente ver el menú.
- No puedes dar información sobre productos específicos fuera de enviar el menú completo.

**Interacción con el Cliente:**

- Mantén la interacción rápida y eficiente.
- Céntrate en los productos solicitados sin ofrecer modificaciones o extras que el cliente no haya mencionado.
- No sugieras ni preguntes sobre ingredientes adicionales o modificaciones.
- El cliente debe solicitar estos cambios por iniciativa propia.

**Procesamiento de la Orden:**

- Si el cliente menciona un producto de manera imprecisa, intenta mapearlo al nombre exacto en el menú.
- Si no estás seguro, utiliza la mejor aproximación basada en el menú disponible.
- Genera un resumen de la conversación en conversationSummary.

**Ejemplos:**

*Solicitud del Cliente:*

"Quiero una pizza Margarita grande y unas alitas BBQ orden."

*Procesamiento:*

- orderItems:
  - { "quantity": 1, "description": "Pizza grande Margarita" }
  - { "quantity": 1, "description": "Orden de Alitas BBQ" }
  - { "quantity": 1, "description": "Media Orden de Alitas BBQ" }

*Solicitud del Cliente:*

"¿Me puedes mandar el menú?"

*Acción:*

- Ejecuta la función send_menu y envía el menú completo al cliente.

**Menú:**

**Entradas:**

- **Alitas**
  - Sabores: BBQ, Picosas, Fritas, Mango Habanero, Mixtas BBQ y Picosas
  - Tamaños: Orden, Media
- **Papas**
  - Tipos: Francesa, Gajos, Mixtas Francesa y Gajos
  - Tamaños: Orden, Media
  - Opciones: Con queso o sin queso
- **Dedos de Queso**

**Pizzas:**

- **Tamaños:** Grande, Mediana, Chica, y con orilla rellena de queso
- **Variedades:** Especial, Carnes Frías, Carranza, Zapata, Villa, Margarita, Adelita, Hawaiana, Mexicana, Rivera, Kahlo, Lupita, Pepperoni, La Leña, La María, Malinche, Philadelphia
- **Opciones:** Ingrediente extra, Mitad y mitad

**Hamburguesas:**

- **Opciones:** Con papas francesas, Con papas gajos, Con papas mixtas
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

**Notas Adicionales:**

- Siempre utiliza el nombre exacto de los productos y opciones tal como aparecen en el menú.
- Si el cliente solicita ver el menú, envíalo de manera amigable y organizada.
- Mantén un tono cordial y utiliza emojis para mejorar la experiencia.
`;

export const SYSTEM_MESSAGE_PHASE_2 = JSON.stringify({
  instructions: [
    "Ejecuta siempre verify_order_items.",
    "Objetivo principal: Verificar que el producto que el cliente quiere ordenar se pueda crear con los ingredientes disponibles en el menú. No es necesario que el nombre del producto coincida exactamente; considera sinónimos, variaciones y abreviaturas comunes.",
    "Permite modificaciones estándar: Si el cliente desea eliminar ingredientes estándar (por ejemplo, 'sin jitomate', 'sin cebolla'), considera estas modificaciones como válidas y no las marques como errores.",
    "Flexibilidad en la interpretación: Si el producto solicitado es similar o puede asociarse claramente con una opción del menú disponible, acéptalo como válido. Por ejemplo, considera 'Orden de papas gajo' como equivalente a 'Orden de Papas gratinadas Gajos'.",
    "Marca errores únicamente cuando:",
    "- Se intenta añadir ingredientes que no están en el 'Menú disponible para la creación del producto'.",
    "- El producto solicitado no tiene una correspondencia razonable con ningún elemento del menú, incluso considerando sinónimos y variaciones comunes.",
    "Comunicación clara: En caso de detectar un error según los criterios anteriores, proporciona un mensaje claro y específico que indique qué parte del pedido no se puede satisfacer.",
  ],
});

export const WAIT_TIMES_MESSAGE = (
  pickupTime: number,
  deliveryTime: number
) => `
🕒 *Tiempos de espera estimados:*

🏠 Recolección en restaurante: ${pickupTime} minutos
🚚 Entrega a domicilio: ${deliveryTime} minutos

Estos tiempos son aproximados y pueden variar según la demanda actual.
`;

export const RESTAURANT_INFO_MESSAGE = `
🍕 *Información y horarios de La Leña*

📍 *Ubicación:* C. Ogazón Sur 36, Centro, 47730 Tototlán, Jal.

📞 *Teléfonos:*
   Fijo: 3919160126
   Celular: 3338423316

🕒 *Horarios:*
   Martes a sábado: 6:00 PM - 11:00 PM
   Domingos: 2:00 PM - 11:00 PM

¡Gracias por tu interés! Esperamos verte pronto.
`;

export const CHATBOT_HELP_MESSAGE = `
🤖💬 *¡Bienvenido al Chatbot de La Leña!*

Este asistente virtual está potenciado por inteligencia artificial para brindarte una experiencia fluida y natural. Aquí te explicamos cómo usarlo:

🚀 *Iniciar una conversación:*
Envía cualquier mensaje para comenzar. Recibirás opciones para:
   📜 Consultar el menú
   ⏱️ Ver tiempos de espera
   🔄 Reordenar
   ℹ️ Información del restaurante

🍕 *Realizar un pedido:*
Escribe o envía un audio con tu pedido. Opciones:
   🏠 Entrega a domicilio: Incluye la dirección completa
   🏃 Recolección en restaurante: Indica el nombre para recoger
Ejemplos:
   '2 pizzas grandes especiales y una coca-cola para entrega a Morelos 66 poniente'
   'Pizza mediana hawaiana y ensalada grande de pollo para recoger, nombre: Juan Pérez'

Una vez generado tu pedido, recibirás un mensaje de confirmación cuando el restaurante lo acepte o un mensaje de rechazo en caso de que no puedan procesarlo.

✏️ *Modificar un pedido:*
Usa la opción en el mensaje de confirmación, solo si el restaurante aún no lo ha aceptado.

❌ *Cancelar un pedido:*
Disponible en las opciones del mensaje de confirmación, solo se puede cancelar si el restaurante aún no ha aceptado el pedido.

💳 *Pagar:*
Genera un enlace de pago desde las opciones del mensaje de confirmación.

🔁 *Reordenar:*
Selecciona 'Reordenar' en el mensaje de bienvenida para ver tus últimas 3 órdenes y poder reordenar con solo un click.

⚠️ *IMPORTANTE:*
Envía un mensaje a la vez y espera la respuesta antes del siguiente para evitar confusiones.

¡Disfruta tu experiencia con nuestro chatbot! 🍽️🤖
`;

export const CHANGE_DELIVERY_INFO_MESSAGE = (updateLink: string) => `
🚚 ¡Actualiza tu información de entrega! 📝
🔗 Por favor, utiliza este enlace para hacer cambios: ${updateLink}
⏳ ¡Ojo! Este enlace tiene validez limitada por motivos de seguridad. 🔒`;
