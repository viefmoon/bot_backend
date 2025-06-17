import logger from '../../utils/logger';
import { sendWhatsAppMessage } from '../../utils/messageSender';
import { ErrorCode, ErrorType, ErrorContext, ErrorResponse } from './types';
import { ERROR_MESSAGES } from './errorMessages';
import { BaseError } from './CustomErrors';

export class ErrorService {
  /**
   * Main error handler that processes all errors in a standardized way
   */
  static async handleError(
    error: unknown,
    context: ErrorContext
  ): Promise<ErrorResponse> {
    // If it's already our custom error, use its properties
    if (error instanceof BaseError) {
      return this.createErrorResponse(error.code, error.type, context);
    }

    // Try to identify the error type and code
    const { errorCode, errorType } = this.identifyError(error);
    
    // Log the error with context
    this.logError(error, errorCode, context);
    
    return this.createErrorResponse(errorCode, errorType, context);
  }

  /**
   * Send error message to user via WhatsApp
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
   * Create a standardized error response
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
   * Identify error type and code from unknown error
   */
  private static identifyError(error: unknown): {
    errorCode: ErrorCode;
    errorType: ErrorType;
  } {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Check for specific error patterns
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

    // Default to technical error
    return { errorCode: ErrorCode.DATABASE_ERROR, errorType: ErrorType.TECHNICAL };
  }

  /**
   * Enhanced error logging with context
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
   * Determine if user should be notified based on error type
   */
  private static shouldNotifyUser(errorType: ErrorType): boolean {
    // Always notify for business logic, validation, and rate limit errors
    // Sometimes notify for technical errors (depends on context)
    // Rarely notify for external service errors (usually retry first)
    return [
      ErrorType.BUSINESS_LOGIC,
      ErrorType.VALIDATION,
      ErrorType.RATE_LIMIT
    ].includes(errorType);
  }

  /**
   * Handle error and send to user in one operation
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