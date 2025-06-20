import logger from '../../utils/logger';
import { sendWhatsAppMessage } from '../../../services/whatsapp';
import { ErrorCode, ErrorType, ErrorContext, ErrorResponse } from './types';
import { ERROR_MESSAGES } from './errorMessages';
import { BaseError } from './CustomErrors';

export class ErrorService {
  /**
   * Manejador principal de errores que procesa todos los errores de manera estandarizada
   */
  static async handleError(
    error: unknown,
    context: ErrorContext
  ): Promise<ErrorResponse> {
    // Si ya es nuestro error personalizado, usar sus propiedades
    if (error instanceof BaseError) {
      return this.createErrorResponse(error.code, error.type, context);
    }

    // Intentar identificar el tipo y código del error
    const { errorCode, errorType } = this.identifyError(error);
    
    // Registrar el error con contexto
    this.logError(error, errorCode, context);
    
    return this.createErrorResponse(errorCode, errorType, context);
  }

  /**
   * Enviar mensaje de error al usuario vía WhatsApp
   */
  static async sendErrorToUser(
    userId: string,
    errorResponse: ErrorResponse
  ): Promise<void> {
    if (errorResponse.shouldNotifyUser) {
      try {
        await sendWhatsAppMessage(userId, errorResponse.userMessage);
      } catch (sendError) {
        logger.error('Failed to send error message to user:', {
          userId,
          errorCode: errorResponse.errorCode,
          sendError
        });
      }
    }
  }

  /**
   * Crear una respuesta de error estandarizada
   */
  private static createErrorResponse(
    errorCode: ErrorCode,
    errorType: ErrorType,
    context?: ErrorContext
  ): ErrorResponse {
    const errorConfig = ERROR_MESSAGES[errorCode];
    
    return {
      userMessage: errorConfig.user,
      logMessage: errorConfig.log,
      errorCode,
      errorType,
      shouldNotifyUser: this.shouldNotifyUser(errorType),
      context
    };
  }

  /**
   * Identificar tipo y código de error desde un error desconocido
   */
  private static identifyError(error: unknown): {
    errorCode: ErrorCode;
    errorType: ErrorType;
  } {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Verificar patrones de error específicos
    if (errorMessage.includes('order not found') || errorMessage.includes('orden no encontrada')) {
      return { errorCode: ErrorCode.ORDER_NOT_FOUND, errorType: ErrorType.BUSINESS_LOGIC };
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('límite')) {
      return { errorCode: ErrorCode.RATE_LIMIT_EXCEEDED, errorType: ErrorType.RATE_LIMIT };
    }
    
    if (errorMessage.includes('stripe')) {
      return { errorCode: ErrorCode.STRIPE_ERROR, errorType: ErrorType.EXTERNAL_SERVICE };
    }
    
    if (errorMessage.includes('whatsapp')) {
      return { errorCode: ErrorCode.WHATSAPP_ERROR, errorType: ErrorType.EXTERNAL_SERVICE };
    }
    
    if (errorMessage.includes('database') || errorMessage.includes('prisma')) {
      return { errorCode: ErrorCode.DATABASE_ERROR, errorType: ErrorType.TECHNICAL };
    }
    
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return { errorCode: ErrorCode.MISSING_REQUIRED_FIELD, errorType: ErrorType.VALIDATION };
    }
    
    if (errorMessage.includes('transcription') || errorMessage.includes('audio')) {
      return { errorCode: ErrorCode.TRANSCRIPTION_ERROR, errorType: ErrorType.TECHNICAL };
    }
    
    if (errorMessage.includes('ai') || errorMessage.includes('gemini')) {
      return { errorCode: ErrorCode.AI_SERVICE_ERROR, errorType: ErrorType.EXTERNAL_SERVICE };
    }

    // Por defecto a error técnico
    return { errorCode: ErrorCode.DATABASE_ERROR, errorType: ErrorType.TECHNICAL };
  }

  /**
   * Registro mejorado de errores con contexto
   */
  private static logError(
    error: unknown,
    errorCode: ErrorCode,
    context: ErrorContext
  ): void {
    const errorDetails = {
      errorCode,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString()
    };

    logger.error('Error occurred:', errorDetails);
  }

  /**
   * Determinar si el usuario debe ser notificado basado en el tipo de error
   */
  private static shouldNotifyUser(errorType: ErrorType): boolean {
    // Siempre notificar para errores de lógica de negocio, validación y límite de tasa
    // A veces notificar para errores técnicos (depende del contexto)
    // Raramente notificar para errores de servicio externo (usualmente reintentar primero)
    return [
      ErrorType.BUSINESS_LOGIC,
      ErrorType.VALIDATION,
      ErrorType.RATE_LIMIT
    ].includes(errorType);
  }

  /**
   * Manejar error y enviar al usuario en una operación
   */
  static async handleAndSendError(
    error: unknown,
    userId: string,
    context: ErrorContext
  ): Promise<void> {
    const errorResponse = await this.handleError(error, context);
    await this.sendErrorToUser(userId, errorResponse);
  }
}