export enum ErrorType {
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  VALIDATION = 'VALIDATION',
  TECHNICAL = 'TECHNICAL',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  RATE_LIMIT = 'RATE_LIMIT'
}

export enum ErrorCode {
  // Business Logic
  ORDER_NOT_FOUND = 'BL001',
  ORDER_CANNOT_MODIFY = 'BL002',
  ORDER_CANNOT_CANCEL = 'BL003',
  RESTAURANT_CLOSED = 'BL004',
  NOT_ACCEPTING_ORDERS = 'BL005',
  PAYMENT_LINK_EXISTS = 'BL006',
  CUSTOMER_NOT_FOUND = 'BL007',
  
  // Validation
  INVALID_PRODUCT = 'VAL001',
  MISSING_DELIVERY_INFO = 'VAL002',
  INVALID_SCHEDULE_TIME = 'VAL003',
  MISSING_REQUIRED_FIELD = 'VAL004',
  INVALID_ORDER_TYPE = 'VAL005',
  
  // Technical
  DATABASE_ERROR = 'TECH001',
  WHATSAPP_API_ERROR = 'TECH002',
  PAYMENT_PROCESSING_ERROR = 'TECH003',
  AI_SERVICE_ERROR = 'TECH004',
  TRANSCRIPTION_ERROR = 'TECH005',
  
  // External Service
  STRIPE_ERROR = 'EXT001',
  GEMINI_ERROR = 'EXT002',
  WHATSAPP_ERROR = 'EXT003',
  
  // Rate Limit
  RATE_LIMIT_EXCEEDED = 'RL001'
}

export interface ErrorContext {
  userId?: string;
  customerId?: string;
  orderId?: number;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface ErrorResponse {
  userMessage: string;
  logMessage: string;
  errorCode: ErrorCode;
  errorType: ErrorType;
  shouldNotifyUser: boolean;
  context?: ErrorContext;
}