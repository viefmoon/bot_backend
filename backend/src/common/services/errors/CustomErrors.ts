import { ErrorCode, ErrorType, ErrorContext } from './types';

export class BaseError extends Error {
  constructor(
    public code: ErrorCode,
    public type: ErrorType,
    message: string,
    public context?: ErrorContext
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BusinessLogicError extends BaseError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super(code, ErrorType.BUSINESS_LOGIC, message, context);
    this.name = 'BusinessLogicError';
  }
}

export class ValidationError extends BaseError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super(code, ErrorType.VALIDATION, message, context);
    this.name = 'ValidationError';
  }
}

export class TechnicalError extends BaseError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super(code, ErrorType.TECHNICAL, message, context);
    this.name = 'TechnicalError';
  }
}

export class ExternalServiceError extends BaseError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super(code, ErrorType.EXTERNAL_SERVICE, message, context);
    this.name = 'ExternalServiceError';
  }
}

export class NotFoundError extends BaseError {
  constructor(code: ErrorCode, message: string, context?: ErrorContext) {
    super(code, ErrorType.BUSINESS_LOGIC, message, context);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string, context?: ErrorContext) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, ErrorType.RATE_LIMIT, message, context);
    this.name = 'RateLimitError';
  }
}