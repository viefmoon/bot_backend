import { sendWhatsAppMessage } from '../../services/whatsapp';
import logger from './logger';
import { BaseError } from '../services/errors/CustomErrors';
import { ERROR_MESSAGES } from '../services/errors/errorMessages';

/**
 * Handles errors in WhatsApp message processing by:
 * 1. Logging the error with context
 * 2. Sending an appropriate error message to the user
 * 
 * This is specifically for WhatsApp handlers where we can't use HTTP responses
 */
export async function handleWhatsAppError(
  error: unknown,
  whatsappNumber: string,
  context: {
    userId?: string;
    operation: string;
    metadata?: any;
  }
): Promise<void> {
  // Log the error with full context
  logger.error('WhatsApp handler error:', {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    whatsappNumber,
    context,
    timestamp: new Date().toISOString()
  });

  // Determine user message
  let userMessage: string;
  
  if (error instanceof BaseError) {
    // Use the specific error message for known errors
    const errorConfig = ERROR_MESSAGES[error.code];
    userMessage = errorConfig?.user || '😔 Lo siento, ocurrió un error. Por favor intenta de nuevo.';
  } else if (error instanceof Error) {
    // For unexpected errors, use a generic message
    userMessage = '😔 Lo siento, ocurrió un error inesperado. Por favor intenta de nuevo más tarde.';
  } else {
    userMessage = '😔 Lo siento, algo salió mal. Por favor intenta de nuevo.';
  }

  // Send error message to user
  try {
    await sendWhatsAppMessage(whatsappNumber, userMessage);
  } catch (sendError) {
    logger.error('Failed to send error message to WhatsApp user:', {
      whatsappNumber,
      originalError: error,
      sendError,
      context
    });
  }
}

/**
 * Wraps a WhatsApp handler function to automatically handle errors
 * Usage: wrapWhatsAppHandler(async (from, message) => { ... })
 */
export function wrapWhatsAppHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  operation: string
): (...args: T) => Promise<R | void> {
  return async (...args: T): Promise<R | void> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Assume first argument is the WhatsApp number (from)
      const whatsappNumber = args[0] as string;
      await handleWhatsAppError(error, whatsappNumber, {
        operation,
        userId: whatsappNumber
      });
    }
  };
}