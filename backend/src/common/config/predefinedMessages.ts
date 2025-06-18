import { prisma } from "../../server";
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

// Helper function to get restaurant config
async function getRestaurantInfo(): Promise<RestaurantInfo> {
  const config = await prisma.restaurantConfig.findFirst();
  
  // Cast explícito para resolver problemas de tipos en VS Code
  const typedConfig = config as any;
  
  if (!typedConfig) {
    return {
      restaurantName: "Establecimiento",
      phoneMain: "",
      phoneSecondary: "",
      address: "",
      city: "",
      state: "",
      postalCode: ""
    };
  }
  
  return {
    restaurantName: typedConfig.restaurantName || "Establecimiento",
    phoneMain: typedConfig.phoneMain || "",
    phoneSecondary: typedConfig.phoneSecondary || "",
    address: typedConfig.address || "",
    city: typedConfig.city || "",
    state: typedConfig.state || "",
    postalCode: typedConfig.postalCode || ""
  };
}

export const BANNED_USER_MESSAGE = async () => {
  const config = await getRestaurantInfo();
  return `Lo sentimos, tu número ha sido baneado debido a la detección de un uso inadecuado de nuestro servicio.

Si crees que es un error, por favor contacta directamente con nosotros:

${config.phoneMain ? `📞 Teléfono: ${config.phoneMain}` : ''}
${config.phoneSecondary ? `📞 Teléfono: ${config.phoneSecondary}` : ''}

Agradecemos tu comprensión y esperamos resolver cualquier malentendido.`;
};

export const WAIT_TIMES_MESSAGE = (
  pickupTime: number,
  deliveryTime: number
) => `
🕒 *Tiempos de espera estimados:*

🏠 Recolección en establecimiento: ${pickupTime} minutos
🚚 Entrega a domicilio: ${deliveryTime} minutos

Estos tiempos son aproximados y pueden variar según la demanda actual.
`;

export const RESTAURANT_INFO_MESSAGE = async () => {
  const { getFormattedBusinessHours } = await import("../utils/timeUtils");
  const config = await getRestaurantInfo();
  const formattedHours = await getFormattedBusinessHours();
  
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

export const CHATBOT_HELP_MESSAGE = async () => {
  const config = await getRestaurantInfo();
  return `
🤖💬 *¡Bienvenido al Chatbot de ${config.restaurantName}!*

Este asistente virtual está potenciado por inteligencia artificial para brindarte una experiencia fluida y natural. Aquí te explicamos cómo usarlo:

🚀 *Iniciar una conversación:*
Envía cualquier mensaje para comenzar. Recibirás opciones para:
   📜 Consultar el menú
   ⏱️ Ver tiempos de espera
   🔄 Reordenar
   ℹ️ Información del restaurante

🍽️ *Realizar un pedido:*
Escribe o envía un audio con tu pedido. Opciones:
   🏠 Entrega a domicilio: Incluye la dirección completa
   🏃 Recolección en establecimiento: Indica el nombre para recoger
Ejemplos:
   '2 platos principales y una bebida para entrega a Morelos 66 poniente'
   'Un combo familiar y una ensalada para recoger, nombre: Juan Pérez'

Una vez generado tu pedido, recibirás un mensaje de confirmación cuando lo aceptemos o un mensaje de rechazo en caso de que no podamos procesarlo.

✏️ *Modificar un pedido:*
Usa la opción en el mensaje de confirmación, solo si aún no lo hemos aceptado.

❌ *Cancelar un pedido:*
Disponible en las opciones del mensaje de confirmación, solo se puede cancelar si aún no hemos aceptado el pedido.

💳 *Pagar:*
Genera un enlace de pago desde las opciones del mensaje de confirmación. Si no pagas en línea, el pago se realizará en efectivo al momento de la entrega.

🔁 *Reordenar:*
Selecciona 'Reordenar' en el mensaje de bienvenida para ver tus últimas 3 órdenes y poder reordenar con solo un click.

⚠️ *IMPORTANTE:*
Envía un mensaje a la vez y espera la respuesta antes del siguiente para evitar confusiones.

¡Disfruta tu experiencia con nuestro chatbot! 🍽️🤖
`;
};

export const CHANGE_DELIVERY_INFO_MESSAGE = (updateLink: string) => `
🚚 ¡Actualiza tu información de entrega! 📝

👇 *PRESIONA AQUÍ PARA ACTUALIZAR* 👇

${updateLink}`;

export const RESTAURANT_NOT_ACCEPTING_ORDERS_MESSAGE = async () => {
  const config = await getRestaurantInfo();
  return `
🚫🍽️ Lo sentimos, no estamos aceptando pedidos en este momento. 😔

⏳ Puedes intentar más tarde o llamarnos directamente:
${config.phoneMain ? `📞 Teléfono: ${config.phoneMain}` : ''}
${config.phoneSecondary ? `📞 Teléfono: ${config.phoneSecondary}` : ''}

¡Gracias por tu comprensión! 🙏
`;
};

export const RESTAURANT_CLOSED_MESSAGE = async () => {
  const { getFormattedBusinessHours } = await import("../utils/timeUtils");
  const formattedHours = await getFormattedBusinessHours();
  
  return `
🚫 Lo sentimos, estamos cerrados en este momento. 😴

🕒 Nuestro horario de atención es:
${formattedHours.split('\n').map(line => '   🗓️ ' + line).join('\n')}

🙏 Gracias por tu comprensión. ¡Esperamos atenderte pronto! 😊
`;
};

export const DELIVERY_INFO_REGISTRATION_MESSAGE = (
  registrationLink: string
) => `
¡Hola! 👋 Antes de continuar, necesitamos que registres tu información de entrega. 📝

👇 *PRESIONA AQUÍ PARA REGISTRARTE* 👇

${registrationLink}
`;

export const PAYMENT_CONFIRMATION_MESSAGE = (orderNumber: number) => `
¡Tu pago para la orden #${orderNumber} ha sido confirmado! 🎉✅ Gracias por tu compra. 🛍️😊
`;

export const WELCOME_MESSAGE_INTERACTIVE = async () => {
  const config = await getRestaurantInfo();
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

// Mensaje cuando se reinicia la conversación
export const CONVERSATION_RESET_MESSAGE = "🔄 Entendido, he olvidado el contexto anterior. ¿En qué puedo ayudarte ahora? 😊";

// Mensaje de error genérico
export const GENERIC_ERROR_MESSAGE = "Lo siento, ocurrió un error procesando tu mensaje. Por favor intenta de nuevo.";

// Mensaje para tipo de mensaje no soportado
export const UNSUPPORTED_MESSAGE_TYPE = "Lo siento, solo puedo procesar mensajes de texto por el momento.";

// Mensaje cuando falla la transcripción de audio
export const AUDIO_TRANSCRIPTION_ERROR = "🎤 Hubo un problema al procesar tu mensaje de audio. Por favor, intenta nuevamente o envía un mensaje de texto.";

// Mensaje de límite de tasa excedido
export const RATE_LIMIT_MESSAGE = "Has alcanzado el límite de mensajes. Por favor espera unos minutos antes de enviar más mensajes.";

// Mensaje cuando no se encuentra una orden
export const ORDER_NOT_FOUND_MESSAGE = "❌ Lo siento, no se pudo encontrar tu orden. 🚫🔍";

// Mensaje cuando no se puede cancelar una orden
export const ORDER_CANNOT_BE_CANCELLED_MESSAGE = (status: string) => {
  const statusMessages = {
    accepted: "Lo sentimos, pero esta orden ya no se puede cancelar porque ya fue aceptada. ⚠️",
    in_preparation: "Lo sentimos, pero esta orden ya está en preparación y no se puede cancelar. 👨‍🍳",
    prepared: "Lo sentimos, pero esta orden ya está preparada y no se puede cancelar. 🍽️",
    in_delivery: "Lo sentimos, pero esta orden ya está en camino y no se puede cancelar. 🚚",
  };
  return statusMessages[status] || "Lo sentimos, esta orden no se puede cancelar en su estado actual.";
};

// Mensaje de confirmación de cancelación de orden
export const ORDER_CANCELLED_MESSAGE = "Tu orden ha sido eliminada exitosamente. ✅";

// Mensaje cuando Stripe no está disponible
export const STRIPE_NOT_AVAILABLE_MESSAGE = "❌ Lo siento, los pagos en línea no están disponibles en este momento. Por favor, realiza el pago en efectivo al recibir tu pedido. 💵";

// Mensaje cuando ya existe un enlace de pago
export const PAYMENT_LINK_EXISTS_MESSAGE = "⚠️ Ya existe un enlace de pago activo para esta orden. Por favor, utiliza el enlace enviado anteriormente o contáctanos si necesitas ayuda. 🔄";