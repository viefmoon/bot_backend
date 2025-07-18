import { RestaurantInfo } from "../types/restaurant";

// Address registration messages
export const ADDRESS_REGISTRATION_SUCCESS = (address: any): string => {
  return `✅ *¡Dirección registrada exitosamente!*

📍 *Tu dirección de entrega:*
${address.street} ${address.number}${address.interiorNumber ? ` Int. ${address.interiorNumber}` : ''}
${address.neighborhood ? `Col. ${address.neighborhood}\n` : ''}${address.city}, ${address.state}

¡Perfecto! Tu dirección ha sido guardada. Ahora puedes realizar tu pedido. 🎉`;
};

export const ADDRESS_UPDATE_SUCCESS = (address: any): string => {
  return `✅ *¡Dirección actualizada correctamente!*

📍 *Tu nueva dirección de entrega:*
${address.street} ${address.number}${address.interiorNumber ? ` Int. ${address.interiorNumber}` : ''}
${address.neighborhood ? `Col. ${address.neighborhood}\n` : ''}${address.city}, ${address.state}

Tu información de entrega ha sido actualizada exitosamente. 👍`;
};

// Restaurant messages that depend on configuration
export const BANNED_USER_MESSAGE = (config: RestaurantInfo): string => {
  return `Lo sentimos, tu número ha sido baneado debido a la detección de un uso inadecuado de nuestro servicio.

Si crees que es un error, por favor contacta directamente con nosotros:

${config.phoneMain ? `📞 Teléfono: ${config.phoneMain}` : ''}
${config.phoneSecondary ? `📞 Teléfono: ${config.phoneSecondary}` : ''}

Agradecemos tu comprensión y esperamos resolver cualquier malentendido.`;
};

export const WAIT_TIMES_MESSAGE = (
  pickupTime: number,
  deliveryTime: number
): string => `
🕒 *Tiempos de espera estimados:*

🏠 Recolección en establecimiento: ${pickupTime} minutos
🚚 Entrega a domicilio: ${deliveryTime} minutos

Estos tiempos son aproximados y pueden variar según la demanda actual.
`;

export const RESTAURANT_INFO_MESSAGE = (
  config: RestaurantInfo,
  formattedHours: string
): string => {
  const fullAddress = [config.address, config.city, config.state, config.postalCode]
    .filter(Boolean)
    .join(", ");
  
  return `
📍 *Información y horarios de ${config.restaurantName}*

${fullAddress ? `📍 *Ubicación:* ${fullAddress}` : ''}

📞 *Teléfonos:*
${config.phoneMain ? `   ${config.phoneMain}` : ''}
${config.phoneSecondary ? `   ${config.phoneSecondary}` : ''}

🕒 *Horarios:*
${formattedHours.split('\n').map(line => '   ' + line).join('\n')}

¡Gracias por tu interés! Esperamos verte pronto.
`;
};

export const CHATBOT_HELP_MESSAGE = (config: RestaurantInfo): string => {
  return `
🤖💬 *¡Bienvenido al Chatbot de ${config.restaurantName}!*

Este asistente virtual está potenciado por inteligencia artificial para brindarte una experiencia fluida y natural. Aquí te explicamos cómo usarlo:

🚀 *Opciones disponibles:*
Al enviar cualquier mensaje, recibirás un menú con las siguientes opciones:
   📜 Ver Menú - Consulta nuestros productos disponibles
   ⏱️ Tiempos de espera - Conoce el tiempo estimado de preparación
   ℹ️ Información y horarios - Dirección, teléfonos y horarios
   🚚 Actualizar entrega - Cambia tu dirección de entrega registrada
   🤖 ¿Cómo usar el bot? - Esta ayuda

🍽️ *Realizar un pedido:*
1. Escribe o envía un audio con los productos que deseas, especificando:
   - Cantidad de cada producto
   - Detalles o especificaciones (sin cebolla, extra queso, etc.)
   - Tipo de pedido: entrega a domicilio o recolección

2. Para entrega a domicilio:
   - Usaremos la dirección predeterminadaque registraste al inicio
   - Si necesitas cambiarla, usa la opción "🚚 Actualizar entrega"

3. Para recolección en establecimiento:
   - Indica que es para recoger y la recolectaras con el nombre que registraste al inicio

Ejemplos:
   '2 hamburguesas tradicionales con papas y una coca cola para entrega a domicilio'
   'Una pizza grande especial sin piña para recoger'

📝 *Proceso del pedido:*
1. Recibirás un resumen con botones de Confirmar o Descartar
2. Al confirmar, tu pedido será enviado al restaurante
3. Recibirás opciones para pagar en línea o por defecto en efectivo

💳 *Pago:*
- Después de confirmar tu pedido, puedes generar un enlace de pago
- Si no pagas en línea, el pago será en efectivo al recibir tu pedido

⚠️ *IMPORTANTE:*
- Los pedidos confirmados NO se pueden modificar ni cancelar
- Tu dirección de entrega debe estar registrada antes de ordenar
- Envía un mensaje a la vez y espera la respuesta

📞 *¿Necesitas hacer cambios en tu pedido?*
Si necesitas modificar algo después de confirmar, comunícate directamente con el restaurante:
${config.phoneMain ? `   📱 ${config.phoneMain}` : ''}
${config.phoneSecondary ? `   📱 ${config.phoneSecondary}` : ''}

¡Disfruta tu experiencia con nuestro chatbot! 🍽️🤖
`;
};

export const CHANGE_DELIVERY_INFO_MESSAGE = (updateLink: string): string => `
🚚 ¡Actualiza tu información de entrega! 📝

👇 *PRESIONA AQUÍ PARA ACTUALIZAR* 👇

${updateLink}`;

export const RESTAURANT_NOT_ACCEPTING_ORDERS_MESSAGE = (config: RestaurantInfo): string => {
  return `
🚫🍽️ Lo sentimos, no estamos aceptando pedidos en este momento. 😔

⏳ Puedes intentar más tarde o llamarnos directamente:
${config.phoneMain ? `📞 Teléfono: ${config.phoneMain}` : ''}
${config.phoneSecondary ? `📞 Teléfono: ${config.phoneSecondary}` : ''}

¡Gracias por tu comprensión! 🙏
`;
};

export const RESTAURANT_CLOSED_MESSAGE = (formattedHours: string): string => {
  return `
🚫 Lo sentimos, estamos cerrados en este momento. 😴

🕒 Nuestro horario de atención es:
${formattedHours.split('\n').map(line => '   🗓️ ' + line).join('\n')}

🙏 Gracias por tu comprensión. ¡Esperamos atenderte pronto! 😊
`;
};

export const DELIVERY_INFO_REGISTRATION_MESSAGE = (
  registrationLink: string
): string => `
¡Hola! 👋 Antes de continuar, necesitamos que registres tu información de entrega. 📝

👇 *PRESIONA AQUÍ PARA REGISTRARTE* 👇

${registrationLink}
`;

export const PAYMENT_CONFIRMATION_MESSAGE = (orderNumber: number): string => `
¡Tu pago para la orden #${orderNumber} ha sido confirmado! 🎉✅ Gracias por tu compra. 🛍️😊
`;

export const WELCOME_MESSAGE_INTERACTIVE = (config: RestaurantInfo) => {
  return {
    type: "list",
    header: {
      type: "text",
      text: `Bienvenido a ${config.restaurantName} 🍽️`
    },
    body: {
      text: "¿Cómo podemos ayudarte hoy? 😊"
    },
    footer: {
      text: "Selecciona una opción:"
    },
    action: {
      button: "Ver opciones",
      sections: [
        {
          title: "Acciones",
          rows: [
            { id: "view_menu", title: "📜 Ver Menú" },
            { id: "wait_times", title: "⏱️ Tiempos de espera" },
            { id: "restaurant_info", title: "ℹ️ Información y horarios" },
            { id: "chatbot_help", title: "🤖 ¿Cómo usar el bot?" },
            {
              id: "change_delivery_info",
              title: "🚚 Actualizar entrega"
            }
          ]
        }
      ]
    }
  };
};

// Static messages that don't depend on configuration
export const CONVERSATION_RESET_MESSAGE = "🔄 Entendido, he olvidado el contexto anterior. ¿En qué puedo ayudarte ahora? 😊";

export const GENERIC_ERROR_MESSAGE = "Lo siento, ocurrió un error procesando tu mensaje. Por favor intenta de nuevo.";

export const UNSUPPORTED_MESSAGE_TYPE = "Lo siento, solo puedo procesar mensajes de texto por el momento.";

export const AUDIO_TRANSCRIPTION_ERROR = "🎤 Hubo un problema al procesar tu mensaje de audio. Por favor, intenta nuevamente o envía un mensaje de texto.";

export const RATE_LIMIT_MESSAGE = "Has alcanzado el límite de mensajes. Por favor espera unos minutos antes de enviar más mensajes.";

export const ORDER_NOT_FOUND_MESSAGE = "❌ Lo siento, no se pudo encontrar tu orden. 🚫🔍";


export const STRIPE_NOT_AVAILABLE_MESSAGE = "❌ Lo siento, los pagos en línea no están disponibles en este momento. Por favor, realiza el pago en efectivo al recibir tu pedido. 💵";

export const PAYMENT_LINK_EXISTS_MESSAGE = "⚠️ Ya existe un enlace de pago activo para esta orden. Por favor, utiliza el enlace enviado anteriormente o contáctanos si necesitas ayuda. 🔄";

export const DEFAULT_ADDRESS_CHANGED = (address: any): string => {
  return `✅ *Dirección principal actualizada*\n\n` +
    `Tu dirección principal ahora es:\n\n` +
    `📍 *${address.name || 'Dirección'}*\n` +
    `${address.street} ${address.number}${address.interiorNumber ? ` Int. ${address.interiorNumber}` : ''}\n` +
    `${address.neighborhood ? `${address.neighborhood}, ` : ''}${address.city}, ${address.state}\n` +
    `${address.deliveryInstructions ? `\n📝 _${address.deliveryInstructions}_` : ''}\n\n` +
    `Esta será la dirección que usaremos para tus próximas entregas a domicilio.`;
};