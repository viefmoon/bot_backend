import { ErrorCode } from './types';

interface ErrorMessageConfig {
  user: string;
  log: string;
}

export const ERROR_MESSAGES: Record<ErrorCode, ErrorMessageConfig> = {
  // Business Logic Errors
  [ErrorCode.ORDER_NOT_FOUND]: {
    user: "❌ Lo siento, no se pudo encontrar tu orden. 🔍",
    log: "Order not found"
  },
  [ErrorCode.RESTAURANT_CLOSED]: {
    user: "🚫 Lo sentimos, estamos cerrados en este momento. 😴",
    log: "Restaurant is closed"
  },
  [ErrorCode.NOT_ACCEPTING_ORDERS]: {
    user: "🚫🍽️ Lo sentimos, no estamos aceptando pedidos en este momento. 😔",
    log: "Restaurant not accepting orders"
  },
  [ErrorCode.PAYMENT_LINK_EXISTS]: {
    user: "⚠️ Ya existe un enlace de pago activo para esta orden.",
    log: "Payment link already exists"
  },
  [ErrorCode.CUSTOMER_NOT_FOUND]: {
    user: "❌ No se encontró información del cliente.",
    log: "Customer not found"
  },
  [ErrorCode.USER_BANNED]: {
    user: "🚫 Tu cuenta ha sido suspendida.",
    log: "User is banned"
  },
  [ErrorCode.NO_PRODUCTS_FOUND]: {
    user: "❌ No encontré productos que coincidan con tu pedido. Por favor intenta de nuevo.",
    log: "No products found matching search"
  },
  [ErrorCode.EMPTY_ORDER]: {
    user: "❌ No pude identificar productos válidos en tu pedido. Por favor intenta de nuevo.",
    log: "Empty order - no valid items identified"
  },
  
  // Validation Errors
  [ErrorCode.INVALID_PRODUCT]: {
    user: "❌ Uno o más productos no son válidos. Por favor, verifica tu pedido.",
    log: "Invalid product ID or configuration"
  },
  [ErrorCode.MISSING_DELIVERY_INFO]: {
    user: "📍 No encontramos tu información de entrega. Por favor, regístrala primero.",
    log: "Missing delivery information"
  },
  [ErrorCode.INVALID_SCHEDULE_TIME]: {
    user: "⏰ El horario seleccionado no es válido. Por favor, elige otro horario.",
    log: "Invalid scheduled delivery time"
  },
  [ErrorCode.MISSING_REQUIRED_FIELD]: {
    user: "❌ Falta información requerida. Por favor, completa todos los campos.",
    log: "Missing required field"
  },
  [ErrorCode.INVALID_OTP]: {
    user: "❌ El código OTP es inválido o ha expirado. Por favor, solicita uno nuevo.",
    log: "Invalid or expired OTP"
  },
  [ErrorCode.INVALID_TOKEN]: {
    user: "⏰ Esta orden ha expirado o ya no está disponible.\n\n🔄 Tu historial ha sido reiniciado. Puedes realizar un nuevo pedido escribiendo lo que deseas ordenar.",
    log: "Invalid or expired action token"
  },
  [ErrorCode.ADDRESS_OUTSIDE_COVERAGE]: {
    user: "📍 La dirección seleccionada está fuera de nuestra área de cobertura. Por favor, selecciona una dirección dentro de la zona de entrega.",
    log: "Address outside delivery coverage area"
  },
  [ErrorCode.FILE_TOO_LARGE]: {
    user: "❌ El archivo es demasiado grande. Por favor envía un archivo más pequeño.",
    log: "File size exceeds maximum allowed"
  },
  [ErrorCode.WEBHOOK_VERIFICATION_FAILED]: {
    user: "❌ Error de verificación del webhook.",
    log: "Webhook signature verification failed"
  },
  
  // Not Found Errors
  [ErrorCode.ADDRESS_NOT_FOUND]: {
    user: "📍 No se encontró la dirección solicitada.",
    log: "Address not found"
  },
  
  // Technical Errors
  [ErrorCode.DATABASE_ERROR]: {
    user: "🔧 Hubo un problema técnico. Por favor, intenta de nuevo más tarde.",
    log: "Database operation failed"
  },
  [ErrorCode.WHATSAPP_API_ERROR]: {
    user: "📱 Hubo un problema al enviar el mensaje. Por favor, intenta de nuevo.",
    log: "WhatsApp API error"
  },
  [ErrorCode.PAYMENT_PROCESSING_ERROR]: {
    user: "💳 Hubo un problema al procesar el pago. Por favor, intenta de nuevo.",
    log: "Payment processing error"
  },
  [ErrorCode.AI_SERVICE_ERROR]: {
    user: "🤖 Hubo un problema al procesar tu solicitud. Por favor, intenta de nuevo.",
    log: "AI service error"
  },
  [ErrorCode.TRANSCRIPTION_ERROR]: {
    user: "🎤 Hubo un problema al procesar tu mensaje de audio. Por favor, intenta nuevamente o envía un mensaje de texto.",
    log: "Audio transcription failed"
  },
  
  // External Service Errors
  [ErrorCode.STRIPE_ERROR]: {
    user: "💳 El servicio de pagos no está disponible temporalmente. Por favor, intenta más tarde.",
    log: "Stripe service error"
  },
  [ErrorCode.GEMINI_ERROR]: {
    user: "🤖 El asistente no está disponible temporalmente. Por favor, intenta más tarde.",
    log: "Gemini AI service error"
  },
  [ErrorCode.WHATSAPP_ERROR]: {
    user: "📱 Error en el servicio de WhatsApp. Por favor, intenta más tarde.",
    log: "WhatsApp service error"
  },
  
  // Rate Limit
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    user: "⏳ Has alcanzado el límite de mensajes. Por favor espera unos minutos antes de enviar más mensajes.",
    log: "Rate limit exceeded"
  },
  
  [ErrorCode.AUTHENTICATION_REQUIRED]: {
    user: 'Authentication required',
    log: 'Missing authentication credentials'
  },
  
  [ErrorCode.INVALID_CREDENTIALS]: {
    user: 'Invalid credentials',
    log: 'Invalid or expired authentication credentials'
  },
  
  [ErrorCode.EMBEDDING_GENERATION_FAILED]: {
    user: '🤖 Hubo un problema al procesar tu búsqueda. Por favor, intenta de nuevo.',
    log: 'Failed to generate embedding for search query'
  },
  
  [ErrorCode.AI_PROCESSING_ERROR]: {
    user: '🤖 No se pudo procesar tu pedido. Por favor intenta de nuevo.',
    log: 'AI processing failed'
  },
  
  // Order Item Validation Errors
  [ErrorCode.VARIANT_REQUIRED]: {
    user: "❌ El producto '${productName}' requiere que elijas una de las siguientes opciones: ${variantNames}.",
    log: "Missing required variant for product"
  },
  [ErrorCode.MODIFIER_GROUP_REQUIRED]: {
    user: "❌ Para el producto '${productName}', es necesario que elijas una opción del grupo '${groupName}'.",
    log: "Required modifier group selection is missing"
  },
  [ErrorCode.MODIFIER_SELECTION_COUNT_INVALID]: {
    user: "❌ Para el grupo de modificadores '${groupName}', debes seleccionar ${range} opción(es).",
    log: "Invalid number of selections for modifier group"
  },
  [ErrorCode.PIZZA_CUSTOMIZATION_REQUIRED]: {
    user: "🍕 Para pedir la pizza '${productName}', debes seleccionar al menos un sabor o ingrediente.",
    log: "Pizza requires at least one customization with action ADD"
  },
  [ErrorCode.INVALID_PIZZA_CONFIGURATION]: {
    user: "🍕❌ La configuración de la pizza '${productName}' es inválida. ${details}",
    log: "Invalid pizza customization configuration"
  },
  [ErrorCode.ITEM_NOT_AVAILABLE]: {
    user: "🚫 Lo sentimos, '${itemName}' ya no está disponible. Por favor, elimínalo de tu pedido.",
    log: "Item not available (inactive)"
  },
  [ErrorCode.MULTIPLE_VALIDATION_ERRORS]: {
    user: "❌ Encontramos algunos problemas con tu pedido. Por favor, revisa los siguientes puntos.",
    log: "Multiple validation errors occurred"
  },
  [ErrorCode.MINIMUM_ORDER_VALUE_NOT_MET]: {
    user: "💰 El pedido mínimo para entrega a domicilio es de $${minimumValue}. Te faltan $${difference} para alcanzarlo. ¿Deseas agregar algo más?",
    log: "Minimum order value for delivery not met"
  }
};