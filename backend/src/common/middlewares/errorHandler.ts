import { Request, Response, NextFunction } from 'express';
import { 
  BaseError, 
  ErrorType,
  ValidationError,
  BusinessLogicError,
  NotFoundError,
  RateLimitError,
  TechnicalError,
  ExternalServiceError
} from '../services/errors';
import logger from '../utils/logger';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    type: string;
    timestamp: string;
    requestId?: string;
    details?: any;
  };
}

/**
 * Maps custom error types to HTTP status codes
 */
function mapErrorTypeToStatusCode(error: BaseError): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof BusinessLogicError) return 409;
  if (error instanceof RateLimitError) return 429;
  if (error instanceof ExternalServiceError) return 502;
  if (error instanceof TechnicalError) return 500;
  
  // Fallback based on error type enum
  switch (error.type) {
    case ErrorType.VALIDATION:
      return 400;
    case ErrorType.NOT_FOUND:
      return 404;
    case ErrorType.BUSINESS_LOGIC:
      return 409;
    case ErrorType.RATE_LIMIT:
      return 429;
    case ErrorType.EXTERNAL_SERVICE:
      return 502;
    case ErrorType.TECHNICAL:
    default:
      return 500;
  }
}

/**
 * Global error handling middleware for Express
 * Provides consistent error responses and proper logging
 */
export function globalErrorHandler(
  err: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  // Handle custom errors
  if (err instanceof BaseError) {
    const statusCode = mapErrorTypeToStatusCode(err);
    
    // Log based on severity
    if (statusCode >= 500) {
      logger.error('Server Error:', {
        error: err.message,
        code: err.code,
        type: err.type,
        context: err.context,
        stack: err.stack,
        requestId,
        path: req.path,
        method: req.method
      });
    } else {
      logger.warn('Client Error:', {
        error: err.message,
        code: err.code,
        type: err.type,
        context: err.context,
        requestId,
        path: req.path,
        method: req.method
      });
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        type: err.type,
        timestamp: new Date().toISOString(),
        requestId
      }
    };
    
    // Include additional details in development
    if (process.env.NODE_ENV === 'development' && err.context) {
      errorResponse.error.details = err.context;
    }
    
    res.status(statusCode).json(errorResponse);
    return;
  }
  
  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    let statusCode = 400;
    let message = 'Database operation failed';
    
    switch (prismaError.code) {
      case 'P2002':
        message = 'A unique constraint would be violated';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        break;
      case 'P2003':
        message = 'Foreign key constraint failed';
        break;
    }
    
    logger.error('Prisma Error:', {
      error: message,
      code: prismaError.code,
      meta: prismaError.meta,
      requestId,
      path: req.path,
      method: req.method
    });
    
    const errorResponse: ErrorResponse = {
      error: {
        code: `PRISMA_${prismaError.code}`,
        message,
        type: ErrorType.TECHNICAL,
        timestamp: new Date().toISOString(),
        requestId
      }
    };
    
    res.status(statusCode).json(errorResponse);
    return;
  }
  
  // Handle unexpected errors
  logger.error('Unhandled Internal Server Error:', {
    error: err.message,
    stack: err.stack,
    requestId,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query
  });
  
  const errorResponse: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred. Please try again later.' 
        : err.message,
      type: ErrorType.TECHNICAL,
      timestamp: new Date().toISOString(),
      requestId
    }
  };
  
  res.status(500).json(errorResponse);
}

/**
 * Async error handler wrapper for route handlers
 * Catches async errors and passes them to the error middleware
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Generate a simple request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}