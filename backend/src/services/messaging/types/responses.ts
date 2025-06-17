/**
 * Tipo unificado para todas las respuestas del sistema
 * Reemplaza AIResponse, MessageResponse, ResponseItem, etc.
 */
export interface UnifiedResponse {
  // Contenido principal
  content?: {
    text?: string;
    interactive?: any;
  };
  
  // Metadatos
  metadata: {
    // Control de envío
    shouldSend: boolean;
    
    // Relevancia para el historial
    isRelevant: boolean;
    
    // Tipo de respuesta
    type: ResponseType;
    
    // IDs relacionados
    preOrderId?: number;
    orderId?: number;
    messageId?: string;
  };
  
  // Datos procesados (para pedidos)
  processedData?: {
    orderItems?: any[];
    orderType?: 'delivery' | 'pickup';
    warnings?: string[];
    scheduledDeliveryTime?: Date;
  };
  
  // Errores
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Tipos de respuesta
 */
export enum ResponseType {
  // Mensajes simples
  TEXT = 'TEXT',
  INTERACTIVE = 'INTERACTIVE',
  
  // Respuestas de procesamiento
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  ORDER_PROCESSING = 'ORDER_PROCESSING',
  
  // Respuestas de consulta
  MENU_INFO = 'MENU_INFO',
  WAIT_TIME_INFO = 'WAIT_TIME_INFO',
  RESTAURANT_INFO = 'RESTAURANT_INFO',
  
  // Errores
  ERROR = 'ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Builder para crear respuestas de forma consistente
 */
export class ResponseBuilder {
  static text(message: string, isRelevant = true): UnifiedResponse {
    return {
      content: { text: message },
      metadata: {
        shouldSend: true,
        isRelevant,
        type: ResponseType.TEXT,
      },
    };
  }
  
  static interactive(message: any, preOrderId?: number): UnifiedResponse {
    return {
      content: { interactive: message },
      metadata: {
        shouldSend: true,
        isRelevant: false,
        type: ResponseType.INTERACTIVE,
        preOrderId,
      },
    };
  }
  
  static orderProcessing(data: any): UnifiedResponse {
    return {
      processedData: data,
      metadata: {
        shouldSend: false,
        isRelevant: true,
        type: ResponseType.ORDER_PROCESSING,
      },
    };
  }
  
  static error(code: string, message: string): UnifiedResponse {
    return {
      content: { text: message },
      error: { code, message },
      metadata: {
        shouldSend: true,
        isRelevant: true,
        type: ResponseType.ERROR,
      },
    };
  }
}