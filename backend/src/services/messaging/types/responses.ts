/**
 * Tipo unificado para todas las respuestas del sistema
 * Reemplaza AIResponse, MessageResponse, ResponseItem, etc.
 * 
 * Reglas de prioridad para el historial:
 * 1. Si metadata.historyMarker existe, siempre se usa ese texto para el historial relevante
 * 2. Si historyMarker no existe y metadata.isRelevant es true, se usa content.text
 * 3. Si isRelevant es false y no hay historyMarker, no se guarda en el historial relevante
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
    
    // Marcador de historial (texto resumido para el historial)
    historyMarker?: string;
  };
  
  // Datos procesados (para pedidos)
  processedData?: {
    orderItems?: any[];
    orderType?: string; // OrderType enum as string
    warnings?: string[];
    scheduledAt?: Date;
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
 * 
 * Reglas importantes:
 * - Si se especifica historyMarker, siempre tiene prioridad sobre content.text para el historial
 * - isRelevant determina si content.text se guarda en el historial (cuando no hay historyMarker)
 * - Los mensajes interactivos son por defecto no relevantes (navegación), pero se puede cambiar
 * - Use textWithHistoryMarker cuando el texto del usuario y del historial deban ser diferentes
 */
export class ResponseBuilder {
  /**
   * Crea una respuesta de texto simple
   * @param message - El mensaje de texto a enviar
   * @param isRelevant - Si el mensaje es relevante para el historial (default: true)
   */
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
  
  /**
   * Crea una respuesta con mensaje interactivo (botones o listas)
   * @param message - El objeto de mensaje interactivo de WhatsApp
   * @param preOrderId - ID del pre-order asociado (opcional)
   * @param isRelevant - Si el mensaje es relevante para el historial (default: false)
   */
  static interactive(message: any, preOrderId?: number, isRelevant = false): UnifiedResponse {
    return {
      content: { interactive: message },
      metadata: {
        shouldSend: true,
        isRelevant,
        type: ResponseType.INTERACTIVE,
        preOrderId,
      },
    };
  }
  
  /**
   * Crea una respuesta de procesamiento de orden (no se envía a WhatsApp)
   * @param data - Datos procesados de la orden
   */
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
  
  /**
   * Crea una respuesta de error
   * @param code - Código de error
   * @param message - Mensaje de error para el usuario
   */
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
  
  /**
   * Crea una respuesta con texto diferente para el usuario y el historial
   * @param textToSend - Texto completo para enviar al usuario
   * @param textForHistory - Texto resumido/alternativo para guardar en el historial relevante
   * @param type - Tipo de respuesta (opcional, default: TEXT)
   */
  static textWithHistoryMarker(textToSend: string, textForHistory: string, type: ResponseType = ResponseType.TEXT): UnifiedResponse {
    return {
      content: { 
        text: textToSend,
      },
      metadata: {
        shouldSend: true,
        isRelevant: true, // Un marcador siempre es relevante por definición
        type,
        historyMarker: textForHistory,
      },
    };
  }
  
  /**
   * Crea una respuesta que no se envía a WhatsApp pero se guarda en el historial
   * @param marker - Texto para guardar en el historial
   * @param processedData - Datos procesados opcionales
   */
  static internalMarker(marker: string, processedData?: any): UnifiedResponse {
    return {
      content: { text: marker },
      processedData,
      metadata: {
        shouldSend: false,
        isRelevant: true,
        type: ResponseType.ORDER_PROCESSING,
      },
    };
  }
  
  /**
   * Crea una respuesta con mensaje de confirmación separado
   * @param mainMessage - Mensaje principal
   * @param confirmationMessage - Mensaje de confirmación adicional
   */
  static withConfirmation(mainMessage: string, confirmationMessage: string): UnifiedResponse[] {
    return [
      this.text(mainMessage),
      this.text(confirmationMessage),
    ];
  }
  
  /**
   * Crea una respuesta vacía (no enviar nada)
   */
  static empty(): UnifiedResponse {
    return {
      metadata: {
        shouldSend: false,
        isRelevant: false,
        type: ResponseType.TEXT,
      },
    };
  }
}