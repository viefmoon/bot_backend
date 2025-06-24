import { GoogleGenAI } from '@google/genai';
import { env } from '../../common/config/envValidator';
import logger from '../../common/utils/logger';
import { ValidationError, ErrorCode } from '../../common/services/errors';

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
   * Genera una respuesta simple de texto
   */
  static async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    try {
      logger.debug('=== GeminiService.generateText DEBUG ===');
      logger.debug(`Prompt: ${prompt}`);
      logger.debug(`System Instruction: ${systemInstruction || 'None'}`);
      
      const client = this.getClient();
      const response = await client.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });
      
      logger.debug('Response:', JSON.stringify(response, null, 2));
      logger.debug(`Extracted text: ${response.text || 'No text in response'}`);
      logger.debug('=== End DEBUG ===');
      
      return response.text || '';
    } catch (error) {
      logger.error('GeminiService: Error generando texto', error);
      throw error;
    }
  }

  /**
   * Genera contenido con historial de conversación
   */
  static async generateContentWithHistory(
    messages: any[],
    systemInstruction?: string,
    tools?: any[],
    toolConfig?: any
  ): Promise<any> {
    try {
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
      
      const response = await client.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: messages,
        config,
      });
      
      // El problema es que response no es serializable directamente con JSON.stringify
      // Vamos a extraer solo las partes importantes para el debug
      // Intentar múltiples formas de loggear la respuesta
      logger.debug('Response object exists:', !!response);
      logger.debug('Response type:', typeof response);
      
      // Método 1: Intentar con util.inspect
      try {
        const util = require('util');
        logger.debug('Raw Gemini response (inspect):', util.inspect(response, { depth: 4, colors: false }));
      } catch (e1) {
        logger.debug('Could not use util.inspect');
      }
      
      // Método 2: Intentar acceder directamente a las propiedades
      try {
        if (response?.candidates?.[0]) {
          const candidate = response.candidates[0];
          logger.debug('Candidate content:', {
            role: candidate.content?.role,
            partsCount: candidate.content?.parts?.length,
            firstPart: candidate.content?.parts?.[0]
          });
        }
      } catch (e2) {
        logger.debug('Could not access candidate properties');
      }
      
      // Método 3: Intentar JSON.stringify con reemplazador
      try {
        const seen = new WeakSet();
        const debugResponse = JSON.stringify(response, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          return value;
        }, 2);
        logger.debug('Raw Gemini response (JSON):', debugResponse);
      } catch (e3) {
        logger.debug('Could not JSON.stringify response');
      }
      
      return response;
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
      logger.debug('=== GeminiService.transcribeAudio DEBUG ===');
      logger.debug(`MimeType: ${mimeType}`);
      logger.debug(`Audio data length: ${audioData.length}`);
      
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
      
      logger.debug('Contents structure:', JSON.stringify({
        role: contents[0].role,
        parts: contents[0].parts.map(p => p.text ? 'text' : 'inlineData')
      }, null, 2));

      const response = await client.models.generateContent({
        model: env.GEMINI_MODEL,
        contents,
      });

      const transcription = response.text?.trim() || '';
      logger.debug(`Transcription result: ${transcription}`);
      logger.debug('=== End DEBUG ===');
      
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
   * Crea una sesión de chat con historial
   */
  static createChat(config?: {
    history?: any[];
    systemInstruction?: string;
    tools?: any[];
  }) {
    const client = this.getClient();
    return client.chats.create({
      model: env.GEMINI_MODEL,
      history: config?.history || [],
      config: {
        systemInstruction: config?.systemInstruction,
        tools: config?.tools ? [{ functionDeclarations: config.tools }] : undefined,
      },
    });
  }
}