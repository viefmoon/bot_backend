import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { env } from '../../common/config/envValidator';
import logger from '../../common/utils/logger';
import { ValidationError, ErrorCode } from '../../common/services/errors';

/**
 * Servicio centralizado para todas las interacciones con Gemini AI
 * Maneja la configuración, el cliente y las operaciones comunes
 */
export class GeminiService {
  private static instance: GoogleGenerativeAI | null = null;
  private static modelCache: Map<string, GenerativeModel> = new Map();

  /**
   * Obtiene la instancia singleton del cliente de Gemini
   */
  static getClient(): GoogleGenerativeAI {
    if (!this.instance) {
      this.instance = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
      logger.info('GeminiService: Cliente inicializado');
    }
    return this.instance;
  }

  /**
   * Obtiene un modelo de Gemini con configuración específica
   * Usa caché para evitar recrear modelos idénticos
   */
  static getModel(config?: {
    model?: string;
    systemInstruction?: string;
    generationConfig?: any;
    tools?: any[];
  }): GenerativeModel {
    const modelName = config?.model || env.GEMINI_MODEL;
    const cacheKey = JSON.stringify(config || { model: modelName });

    // Verificar caché
    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey)!;
    }

    // Crear nuevo modelo
    const client = this.getClient();
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: config?.systemInstruction,
      generationConfig: config?.generationConfig,
      tools: config?.tools,
    });

    // Guardar en caché
    this.modelCache.set(cacheKey, model);
    return model;
  }

  /**
   * Genera una respuesta simple de texto
   */
  static async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    try {
      const model = this.getModel({ systemInstruction });
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text() || '';
    } catch (error) {
      logger.error('GeminiService: Error generando texto', error);
      throw error;
    }
  }

  /**
   * Genera contenido con historial de conversación
   */
  static async generateContentWithHistory(
    messages: Content[],
    systemInstruction?: string,
    tools?: any[]
  ): Promise<any> {
    try {
      const model = this.getModel({ systemInstruction, tools });
      const result = await model.generateContent({
        contents: messages,
      });
      return result.response;
    } catch (error) {
      logger.error('GeminiService: Error generando contenido con historial', error);
      throw error;
    }
  }

  /**
   * Transcribe audio a texto
   */
  static async transcribeAudio(
    audioData: string,
    mimeType: string
  ): Promise<string> {
    try {
      const model = this.getModel();
      
      const prompt = `Transcribe el siguiente audio a texto. 
      Si el audio no es claro o no se puede entender, responde con "ERROR_TRANSCRIPTION".
      Si el audio está en otro idioma que no sea español, tradúcelo al español.
      Solo devuelve el texto transcrito, sin explicaciones adicionales.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: audioData,
          },
        },
      ]);

      const transcription = result.response.text().trim();
      
      if (!transcription || transcription === 'ERROR_TRANSCRIPTION' || transcription.length < 2) {
        throw new ValidationError(
          ErrorCode.TRANSCRIPTION_ERROR,
          'No se pudo transcribir el audio',
          { metadata: { transcriptionResult: transcription } }
        );
      }

      return transcription;
    } catch (error) {
      logger.error('GeminiService: Error transcribiendo audio', error);
      throw error;
    }
  }

  /**
   * Limpia la caché de modelos
   */
  static clearCache(): void {
    this.modelCache.clear();
    logger.info('GeminiService: Caché de modelos limpiada');
  }
}