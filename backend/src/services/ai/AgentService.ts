import { GeminiService } from './GeminiService';
import logger from '../../common/utils/logger';
import { getAgentPrompt } from './prompts';
import { getAgentTools } from './tools';

interface Content {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

export class AgentService {
  static async processMessage(
    messages: Content[]
  ): Promise<any> {
    try {
      const systemInstruction = await this.getAgentInstruction();
      const tools = getAgentTools();
      
      
      const response = await GeminiService.generateContentWithHistory(
        messages,
        systemInstruction,
        tools
      );
      
      
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