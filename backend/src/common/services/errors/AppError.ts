import { ErrorCode, ErrorType } from './types';

/**
 * Unified error class for the application
 */
export class AppError extends Error {
  public readonly isOperational = true;
  
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly type: ErrorType = ErrorType.BUSINESS_LOGIC,
    public readonly metadata?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Factory methods for common error types
   */
  static notFound(resource: string, metadata?: any): AppError {
    return new AppError(
      ErrorCode.ORDER_NOT_FOUND, // Using existing error code
      `${resource} not found`,
      ErrorType.BUSINESS_LOGIC,
      metadata
    );
  }

  static validation(message: string, metadata?: any): AppError {
    return new AppError(
      ErrorCode.MISSING_REQUIRED_FIELD, // Using existing error code
      message,
      ErrorType.VALIDATION,
      metadata
    );
  }

  static unauthorized(message = 'Unauthorized', metadata?: any): AppError {
    return new AppError(
      ErrorCode.ORDER_CANNOT_MODIFY, // Using existing error code for auth issues
      message,
      ErrorType.BUSINESS_LOGIC,
      metadata
    );
  }

  static database(message: string, metadata?: any): AppError {
    return new AppError(
      ErrorCode.DATABASE_ERROR,
      message,
      ErrorType.TECHNICAL,
      metadata
    );
  }

  static external(service: string, message: string, metadata?: any): AppError {
    return new AppError(
      ErrorCode.AI_SERVICE_ERROR, // Using existing error code
      `${service}: ${message}`,
      ErrorType.EXTERNAL_SERVICE,
      metadata
    );
  }

  static rateLimit(message = 'Too many requests', metadata?: any): AppError {
    return new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      ErrorType.RATE_LIMIT,
      metadata
    );
  }
}