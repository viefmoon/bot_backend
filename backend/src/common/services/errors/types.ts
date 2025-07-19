export enum ErrorType {
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  VALIDATION = 'VALIDATION',
  TECHNICAL = 'TECHNICAL',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  RATE_LIMIT = 'RATE_LIMIT',
  NOT_FOUND = 'NOT_FOUND'
}

export enum ErrorCode {
  // Business Logic
  ORDER_NOT_FOUND = 'BL001',
  RESTAURANT_CLOSED = 'BL004',
  NOT_ACCEPTING_ORDERS = 'BL005',
  PAYMENT_LINK_EXISTS = 'BL006',
  CUSTOMER_NOT_FOUND = 'BL007',
  USER_BANNED = 'BL008',
  NO_PRODUCTS_FOUND = 'BL009',
  EMPTY_ORDER = 'BL010',
  
  // Validation
  INVALID_PRODUCT = 'VAL001',
  MISSING_DELIVERY_INFO = 'VAL002',
  INVALID_SCHEDULE_TIME = 'VAL003',
  MISSING_REQUIRED_FIELD = 'VAL004',
  INVALID_OTP = 'VAL006',
  INVALID_TOKEN = 'VAL007',
  FILE_TOO_LARGE = 'VAL009',
  WEBHOOK_VERIFICATION_FAILED = 'VAL010',
  
  // Not Found
  ADDRESS_NOT_FOUND = 'NF001',
  
  // Validation - Address
  ADDRESS_OUTSIDE_COVERAGE = 'VAL008',
  
  // Technical
  DATABASE_ERROR = 'TECH001',
  WHATSAPP_API_ERROR = 'TECH002',
  PAYMENT_PROCESSING_ERROR = 'TECH003',
  AI_SERVICE_ERROR = 'TECH004',
  TRANSCRIPTION_ERROR = 'TECH005',
  AUTHENTICATION_REQUIRED = 'TECH006',
  INVALID_CREDENTIALS = 'TECH007',
  EMBEDDING_GENERATION_FAILED = 'TECH008',
  AI_PROCESSING_ERROR = 'TECH009',
  
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
  orderId?: number | string; // Support both numeric and UUID order IDs
  operation?: string;
  metadata?: Record<string, any>;
  [key: string]: any; // Allow additional properties
}

export interface ErrorResponse {
  userMessage: string;
  logMessage: string;
  errorCode: ErrorCode;
  errorType: ErrorType;
  shouldNotifyUser: boolean;
  context?: ErrorContext;
}