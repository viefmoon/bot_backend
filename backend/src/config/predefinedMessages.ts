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
    "Analiza las conversaciones entre el usuario y el asistente, luego usa la función 'preprocess_order' para generar una lista detallada de los productos mencionados mapeandolos en base al menu disponible, incluidas sus cantidades y descripciones.",
    "Por defecto, asume que el tipo de entrega es 'delivery' y la hora programada es null (entrega inmediata). Solo considera un tipo de entrega diferente o una hora programada si el cliente lo menciona explícitamente.",
    "No preguntes por el tipo de pedido ni la hora de entrega a menos que el cliente lo solicite específicamente.",
    "Ejecuta la función 'send_menu' únicamente cuando el cliente solicite explícitamente ver el menú, no puedes dar informacion productos específicos, solo puedes enviar el menú completo.",
    "Mantén la interacción rápida y eficiente, centrándote en los productos solicitados sin ofrecer modificaciones o extras. Solo procesa lo que el cliente menciona específicamente.",
    "No sugieras ni preguntes sobre ingredientes adicionales o modificaciones. El cliente debe solicitar estos cambios por iniciativa propia.",
  ],
  menu: {
    entradas: {
      alitas: {
        sabores: ["BBQ", "Picosas", "Fritas", "Mango habanero", "Mixtas BBQ y picosas"],
        tamaños: ["orden", "media"],
        acompañamiento: "chile de aceite"
      },
      papas: {
        tipos: ["Francesa", "Gajos", "Mixtas francesa y gajos"],
        tamaños: ["orden", "media"],
        opciones: ["Con queso", "Sin queso"],
        acompañamiento: "aderezo"
      },
      dedosDeQueso: {}
    },
    pizzas: {
      tamaños: ["Grande", "Mediana", "Chica"],
      opcionesOrilla: ["rellena"],
      variedades: [
        {nombre: "Especial", ingredientes: ["Pepperoni", "Salchicha", "Jamón", "Salami", "Chile morrón"]},
        {nombre: "Carnes Frías", ingredientes: ["Pepperoni", "Salchicha", "Jamón", "Salami"]},
        {nombre: "Carranza", ingredientes: ["Chorizo", "Jamón", "Chile jalapeño", "Jitomate"]},
        {nombre: "Zapata", ingredientes: ["Salami", "Jamón", "Champiñón"]},
        {nombre: "Villa", ingredientes: ["Chorizo", "Tocino", "Piña", "Chile jalapeño"]},
        {nombre: "Margarita", ingredientes: ["3 Quesos", "Jitomate", "Albahaca"]},
        {nombre: "Adelita", ingredientes: ["Jamón", "Piña", "Arándano"]},
        {nombre: "Hawaiana", ingredientes: ["Jamón", "Piña"]},
        {nombre: "Mexicana", ingredientes: ["Chorizo", "Cebolla", "Chile jalapeño", "Jitomate"]},
        {nombre: "Rivera", ingredientes: ["Elote", "Champiñón", "Chile morrón"]},
        {nombre: "Kahlo", ingredientes: ["Calabaza", "Elote", "Champiñón", "Jitomate", "Chile morrón"]},
        {nombre: "Lupita", ingredientes: ["Carne molida", "Tocino", "Cebolla", "Chile morrón"]},
        {nombre: "Pepperoni", ingredientes: ["Pepperoni"]},
        {nombre: "La Leña", ingredientes: ["Tocino", "Pierna", "Chorizo", "Carne molida"]},
        {nombre: "La María", ingredientes: ["Pollo BBQ", "Piña", "Chile jalapeño"]},
        {nombre: "Malinche", ingredientes: ["3 Quesos", "Queso de cabra", "Champiñón", "Jamón", "Chile seco", "Albahaca"]},
        {nombre: "Philadelphia", ingredientes: ["Jamon", "Queso philadelphia", "Chile", "Albahaca"]}
      ],
      opciones: ["Personalizada con hasta 3 ingredientes", "Ingrediente extra", "Mitad y mitad"],
      acompañamientos: ["chile de aceite", "aderezo"]
    },
    hamburguesas: {
      ingredientesBase: ["cebolla", "jitomate", "lechuga", "chile jalapeño", "catsup", "aderezo", "crema", "mostaza"],
      variedades: [
        {nombre: "Tradicional", ingredientes: ["Carne de res", "tocino", "queso amarillo", "queso asadero"]},
        {nombre: "Especial", ingredientes: ["Carne de res", "tocino", "pierna", "queso amarillo", "queso asadero"]},
        {nombre: "Hawaiana", ingredientes: ["Carne de res", "tocino", "piña", "jamón", "queso amarillo", "queso asadero"]},
        {nombre: "Pollo", ingredientes: ["Pechuga de pollo a la plancha", "tocino", "queso amarillo", "queso asadero"]},
        {nombre: "BBQ", ingredientes: ["Carne de res", "salsa BBQ", "tocino", "queso amarillo", "queso asadero", "cebolla guisada"]},
        {nombre: "Lenazo", ingredientes: ["Doble carne de sirlón", "tocino", "queso amarillo", "queso asadero"]},
        {nombre: "Cubana", ingredientes: ["Carne de res", "tocino", "pierna", "salchicha", "jamón", "queso amarillo"]}
      ],
      opcionesPapas: ["Francesa", "Gajos", "Mixtas"]
    },
    ensaladas: {
      tipos: ["De Pollo", "De Jamón"],
      tamaños: ["Chica", "Grande"],
      ingredientes: ["Pollo a la plancha o jamón", "chile morrón", "elote", "lechuga", "jitomate", "zanahoria", "queso parmesano", "aderezo", "betabel crujiente"],
      extras: ["vinagreta"]
    },
    bebidas: {
      aguasFrescas: ["Agua de horchata", "Limonada", "Limonada Mineral"],
      refrescos: ["Coca Cola", "7up", "Mirinda", "Sangría", "Agua Mineral", "Squirt"],
      otras: ["Sangría Preparada", "Micheladas"],
      cafeCaliente: ["Americano", "Capuchino", "Chocolate", "Mocachino", "Latte Vainilla", "Latte Capuchino"],
      frappes: ["Capuchino", "Coco", "Caramelo", "Cajeta", "Mocaccino", "Galleta", "Bombón"],
      frappesEspeciales: ["Rompope", "Mazapán", "Magnum"]
    },
    cocteleria: [
      "Vino tinto", "Sangría con vino", "Vampiro", "Gin de Maracuyá", "Margarita", 
      "Ruso Blanco", "Palo santo", "Gin de pepino", "Mojito", "Piña colada", 
      "Piñada", "Conga", "Destornillador", "Paloma", "Carajillo", 
      "Tinto de verano", "Clericot"
    ]
  }
});

export const SYSTEM_MESSAGE_PHASE_2 = JSON.stringify({
  instructions: [
    "Ejecuta siempre verify_order_items",
    "lo que haces es verificar que el producto que el cliente quiere ordenar se pueda crear con los ingredientes disponibles en el menu, si no se puede crear, no es necesario que coincida exactamente.",
    "Permite que eliminen ingredientes estándar (por ejemplo, 'sin jitomate', 'sin cebolla'), considera estas modificaciones como válidas y no las marques como errores.",
    "Marca como error si se intenta añadir ingredientes que no están en 'Menu disponible para la creacion del producto'.",
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
