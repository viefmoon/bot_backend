import { GeminiService } from './GeminiService';
import logger from '../../common/utils/logger';
import { getAgentPrompt } from './prompts';
import { getAgentTools } from './tools';

// Definiciones de tipos para el nuevo SDK
interface Content {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

/**
 * Servicio de AI con agente principal
 */
export class AgentService {
  /**
   * Procesa mensajes con el agente principal
   */
  static async processMessage(
    messages: Content[]
  ): Promise<any> {
    try {
      const systemInstruction = await this.getAgentInstruction();
      const tools = getAgentTools();
      
      // Log completo de lo que recibe el modelo
      logger.info('=== AgentService.processMessage ===');
      logger.debug('=== COMPLETE AI MODEL INPUT ===');
      logger.debug(`System Instruction:\n${systemInstruction}`);
      (logger as any).json('Messages:', messages);
      (logger as any).json('Tools:', tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      })));
      logger.debug('=== END AI MODEL INPUT ===');
      
      const response = await GeminiService.generateContentWithHistory(
        messages,
        systemInstruction,
        tools
      );
      
      logger.debug('=== AI MODEL RESPONSE ===');
      (logger as any).json('Response:', response);
      logger.debug('=== END AI MODEL RESPONSE ===');
      
      return response;
    } catch (error) {
      logger.error('AgentService: Error procesando mensaje', error);
      throw error;
    }
  }

  /**
   * Obtiene la instrucción del sistema para el agente principal
   */
  private static async getAgentInstruction(): Promise<string> {
    const { RestaurantService } = await import('../restaurant/RestaurantService');
    const config = await RestaurantService.getConfig();
    return getAgentPrompt(config.restaurantName);
  }
}