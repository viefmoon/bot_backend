import { GoogleGenAI } from '@google/genai';
import { env } from '../../common/config/envValidator';
import logger from '../../common/utils/logger';
import { ValidationError, ErrorCode, ExternalServiceError } from '../../common/services/errors';

/**
 * Función helper para determinar si un error es transitorio y se debe reintentar
 */
const isRetriableError = (error: any): boolean => {
  // Errores 5xx son errores del servidor de Google, son los candidatos perfectos para reintentar
  if (error.name === 'ServerError' || (error.message && error.message.includes('500'))) {
    return true;
  }
  // Errores de red o disponibilidad del servicio
  if (error.message && (error.message.includes('503') || error.message.includes('Service Unavailable'))) {
    return true;
  }
  // Errores de timeout o conexión
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
    return true;
  }
  // Errores de la API de Google que indican sobrecarga temporal
  if (error.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'))) {
    return true;
  }
  
  return false;
};

/**
 * Servicio centralizado para todas las interacciones con Gemini AI
 * Maneja la configuración, el cliente y las operaciones comunes
 */
export class GeminiService {
  private static instance: GoogleGenAI | null = null;

  /**
   * Obtiene la instancia singleton del cliente de Gemini
   */
  static getClient(): GoogleGenAI {
    if (!this.instance) {
      this.instance = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
      logger.info('GeminiService: Cliente inicializado');
      logger.info(`GeminiService: Using model ${env.GEMINI_MODEL}`);
    }
    return this.instance;
  }

  /**
   * Genera contenido con historial de conversación
   */
  static async generateContentWithHistory(
    messages: any[],
    systemInstruction?: string,
    tools?: any[],
    toolConfig?: any,
    enableDynamicThinking: boolean = true
  ): Promise<any> {
    const client = this.getClient();
    
    // Construir la configuración
    const config: any = {
      systemInstruction,
      tools: tools ? [{ functionDeclarations: tools }] : undefined,
    };
    
    // Agregar toolConfig si se proporciona
    if (toolConfig) {
      config.toolConfig = toolConfig;
    }
    
    // Agregar configuración de pensamiento dinámico para modelos compatibles
    // Log simplificado del historial
    logger.debug(`GeminiService: Processing ${messages.length} messages`);
    
    if (enableDynamicThinking && env.GEMINI_MODEL.includes('2.5')) {
      const thinkingBudget = env.GEMINI_THINKING_BUDGET ? parseInt(env.GEMINI_THINKING_BUDGET) : -1;
      
      // Solo agregar thinkingConfig si no es 0 o si está explícitamente configurado
      if (thinkingBudget !== 0 || env.GEMINI_THINKING_BUDGET === '0') {
        config.thinkingConfig = {
          thinkingBudget
        };
        
        logger.debug(`GeminiService: Thinking config set - budget: ${thinkingBudget === -1 ? 'dynamic' : thinkingBudget}`);
      }
    }
    
    // Parámetros para la lógica de reintentos
    const maxRetries = 3;
    const initialDelay = 1000; // 1 segundo

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        // Log del intento
        if (attempt > 0) {
          logger.info(`Reintentando llamada a Gemini API. Intento ${attempt + 1}/${maxRetries}...`);
        } else {
          logger.info('Llamando a Gemini API...');
        }
        
        const response = await client.models.generateContent({
          model: env.GEMINI_MODEL,
          contents: messages,
          config,
        });
        
        logger.info('Gemini API respondió exitosamente.');
        
        // Log simplificado de la respuesta
        if (response.text) {
          logger.debug(`Gemini response: Text (${response.text.length} chars)`);
        }
        if (response.functionCalls) {
          const functionNames = response.functionCalls.map((fc: any) => fc.name).join(', ');
          logger.debug(`Gemini response: Function calls - ${functionNames}`);
        }
        
        return response; // Si tiene éxito, salimos del bucle y devolvemos la respuesta

      } catch (error: any) {
        attempt++;
        logger.warn(`Intento ${attempt}/${maxRetries} falló para la API de Gemini. Error: ${error.message}`);

        // Si es el último intento o si el error NO es reintentable, lanzamos la excepción final
        if (attempt >= maxRetries || !isRetriableError(error)) {
          logger.error(`Error final de Gemini API después de ${attempt} intentos. El error NO es reintentable o se alcanzó el límite.`);
          throw new ExternalServiceError(
            ErrorCode.GEMINI_ERROR,
            `El servicio de IA falló después de ${attempt} intentos: ${error.message}`,
            { originalError: error.message }
          );
        }

        // Calcular el tiempo de espera con backoff exponencial y un poco de "jitter" (aleatoriedad)
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        logger.info(`Error transitorio detectado. Esperando ${delay.toFixed(0)}ms antes del siguiente reintento.`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Esto nunca debería ejecutarse pero lo incluimos por seguridad
    throw new ExternalServiceError(
      ErrorCode.GEMINI_ERROR,
      'Error inesperado en el bucle de reintentos'
    );
  }

  /**
   * Transcribe audio a texto
   */
  static async transcribeAudio(
    audioData: string,
    mimeType: string
  ): Promise<string> {
    logger.debug(`GeminiService.transcribeAudio: Processing ${audioData.length} bytes of ${mimeType}`);
    
    const client = this.getClient();
    
    const prompt = `Transcribe el siguiente audio a texto. 
    Si el audio no es claro o no se puede entender, responde con "ERROR_TRANSCRIPTION".
    Si el audio está en otro idioma que no sea español, tradúcelo al español.
    Solo devuelve el texto transcrito, sin explicaciones adicionales.`;

    const contents = [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: audioData,
            },
          },
        ],
      },
    ];
    
    // Parámetros para la lógica de reintentos
    const maxRetries = 3;
    const initialDelay = 1000; // 1 segundo

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        // Log del intento
        if (attempt > 0) {
          logger.info(`Reintentando transcripción de audio. Intento ${attempt + 1}/${maxRetries}...`);
        } else {
          logger.info('Transcribiendo audio con Gemini API...');
        }

        const response = await client.models.generateContent({
          model: env.GEMINI_MODEL,
          contents,
        });

        const transcription = response.text?.trim() || '';
        logger.debug(`Transcription result: ${transcription.length} chars`);
        
        if (!transcription || transcription === 'ERROR_TRANSCRIPTION' || transcription.length < 2) {
          throw new ValidationError(
            ErrorCode.TRANSCRIPTION_ERROR,
            'No se pudo transcribir el audio',
            { metadata: { transcriptionResult: transcription } }
          );
        }

        logger.info('Transcripción de audio exitosa.');
        return transcription;

      } catch (error: any) {
        // Si el error es de validación (audio no transcribible), no reintentamos
        if (error instanceof ValidationError) {
          throw error;
        }
        
        attempt++;
        logger.warn(`Intento ${attempt}/${maxRetries} falló para transcripción de audio. Error: ${error.message}`);

        // Si es el último intento o si el error NO es reintentable, lanzamos la excepción final
        if (attempt >= maxRetries || !isRetriableError(error)) {
          logger.error(`Error final de transcripción después de ${attempt} intentos.`);
          throw new ExternalServiceError(
            ErrorCode.GEMINI_ERROR,
            `El servicio de transcripción falló después de ${attempt} intentos: ${error.message}`,
            { originalError: error.message }
          );
        }

        // Calcular el tiempo de espera con backoff exponencial
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        logger.info(`Error transitorio detectado. Esperando ${delay.toFixed(0)}ms antes del siguiente reintento.`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Esto nunca debería ejecutarse pero lo incluimos por seguridad
    throw new ExternalServiceError(
      ErrorCode.GEMINI_ERROR,
      'Error inesperado en el bucle de reintentos de transcripción'
    );
  }

}