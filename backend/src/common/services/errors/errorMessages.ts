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
  [ErrorCode.ORDER_CANNOT_MODIFY]: {
    user: "⚠️ Lo siento, esta orden ya no se puede modificar porque ya fue procesada.",
    log: "Cannot modify order - invalid status"
  },
  [ErrorCode.ORDER_CANNOT_CANCEL]: {
    user: "⚠️ Lo siento, esta orden ya no se puede cancelar.",
    log: "Cannot cancel order - invalid status"
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
  [ErrorCode.INVALID_ORDER_TYPE]: {
    user: "❌ Tipo de orden no válido. Por favor, selecciona entrega a domicilio o recolección.",
    log: "Invalid order type"
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
  }
};