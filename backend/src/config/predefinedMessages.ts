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

export const SYSTEM_MESSAGE_PHASE_1 = JSON.stringify({
  instructions: [
    "Eres un asistente virtual del 'Restaurante La Leña'. Utiliza un lenguaje amigable y cercano, incorporando emojis para mejorar la experiencia.",
    "Analiza las conversaciones entre el usuario y el asistente, luego usa la función 'preprocess_order' para generar una lista detallada de los productos mencionados, incluidas sus cantidades y descripciones.",
    "Por defecto, asume que el tipo de entrega es 'delivery' y la hora programada es null (entrega inmediata). Solo considera un tipo de entrega diferente o una hora programada si el cliente lo menciona explícitamente.",
    "No preguntes por el tipo de pedido ni la hora de entrega a menos que el cliente lo solicite específicamente.",
    "Ejecuta la función 'send_menu' únicamente cuando el cliente solicite explícitamente ver el menú.",
    "Mantén la interacción rápida y eficiente, centrándote en los productos solicitados sin ofrecer modificaciones o extras. Solo procesa lo que el cliente menciona específicamente.",
    "No sugieras ni preguntes sobre ingredientes adicionales o modificaciones. El cliente debe solicitar estos cambios por iniciativa propia.",
  ],
});

export const SYSTEM_MESSAGE_PHASE_2 = JSON.stringify({
  instructions: [
    "Ejecuta siempre verify_order_items",
    "Analiza detalladamente el producto solicitado y verifica si se puede construir el producto en base a su menu disponible para la creacion.",
    "Permite que eliminen ingredientes estándar (por ejemplo, 'sin jitomate', 'sin cebolla'), considera estas modificaciones como válidas y no las marques como errores.",
    "Marca como error si se intenta añadir ingredientes que no están en 'Menu disponible para la creacion'.",
    "Si hay discrepancias por adición de ingredientes no listados, indica específicamente cuáles.",
    "Verifica que todos los ingredientes mencionados en 'Producto solicitado' estén en 'Menu disponible para la creacion', excepto los que se piden eliminar.",
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
Para actualizar tu información de entrega, por favor utiliza este enlace: ${updateLink}

Este enlace es válido por un tiempo limitado por razones de seguridad.
`;
