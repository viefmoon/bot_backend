import { GeminiService } from './GeminiService';
import { OrderType } from '@prisma/client';
import logger from '../../common/utils/logger';
import { ProductService } from '../products/ProductService';
import { getGeneralAgentPrompt, getOrderAgentPrompt, getUnifiedAgentPrompt } from './prompts';
import { getGeneralAgentTools, getOrderAgentTools, getUnifiedAgentTools } from './tools';
import { MenuSearchService } from './MenuSearchService';

// Definiciones de tipos para el nuevo SDK
interface Content {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

// Contexto para el agente de órdenes
interface OrderContext {
  itemsSummary: string;
  relevantMenu: string;
  orderType?: string;
}

/**
 * Servicio de AI con agentes especializados
 */
export class AgentService {
  /**
   * Determina si usar el agente unificado basado en configuración
   */
  static useUnifiedAgent(): boolean {
    return process.env.USE_UNIFIED_AGENT === 'true';
  }
  /**
   * Procesa mensajes con el agente general o unificado
   */
  static async processMessage(
    messages: Content[]
  ): Promise<any> {
    try {
      // Determinar qué agente usar
      const useUnified = this.useUnifiedAgent();
      const systemInstruction = useUnified 
        ? await this.getUnifiedAgentInstruction()
        : await this.getGeneralAgentInstruction();
      const tools = useUnified ? getUnifiedAgentTools() : getGeneralAgentTools();
      
      // Log completo de lo que recibe el modelo
      logger.info(`=== AgentService.processMessage: Using ${useUnified ? 'UNIFIED' : 'GENERAL'} agent ===`);
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
      return response;
    } catch (error) {
      logger.error('AgentService: Error procesando mensaje', error);
      throw error;
    }
  }
  
  /**
   * Procesa una orden con el agente especializado
   */
  static async processOrderMapping(
    orderContext: OrderContext
  ): Promise<any> {
    try {
      
      // Crear mensaje para el agente de órdenes
      const messages: Content[] = [{
        role: 'user',
        parts: [{ 
          text: `ORDEN: ${orderContext.itemsSummary}\nTIPO: ${orderContext.orderType || OrderType.DELIVERY}` 
        }]
      }];
      
      const systemInstruction = this.getOrderAgentInstruction(orderContext.relevantMenu);
      const tools = getOrderAgentTools();
      
      // Configurar modo ANY para forzar la ejecución de función
      const toolConfig = {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: ['map_order_items']
        }
      };
      
      // Log completo de lo que recibe el modelo de órdenes
      logger.debug('=== COMPLETE ORDER AGENT INPUT ===');
      logger.debug('System Instruction includes menu:');
      logger.debug(`Order: ${orderContext.itemsSummary}`);
      logger.debug(`Type: ${orderContext.orderType || OrderType.DELIVERY}`);
      try {
        const menuParsed = JSON.parse(orderContext.relevantMenu);
        (logger as any).json('Relevant Menu:', menuParsed);
      } catch (e) {
        logger.debug(`Relevant Menu: ${orderContext.relevantMenu}`);
      }
      logger.debug('=== END ORDER AGENT INPUT ===');
      
      logger.info('Calling Gemini API for order processing...');
      
      const response = await GeminiService.generateContentWithHistory(
        messages,
        systemInstruction,
        tools,
        toolConfig
      );
      
      return response;
    } catch (error) {
      logger.error('OrderAgent: Error procesando orden', error);
      throw error;
    }
  }
  
  /**
   * Instrucciones para el agente general
   */
  private static async getGeneralAgentInstruction(): Promise<string> {
    let restaurantName = 'nuestro restaurante';
    
    try {
      // Obtener configuración del restaurante
      const { RestaurantService } = await import('../restaurant/RestaurantService');
      const restaurantConfig = await RestaurantService.getConfig();
      restaurantName = restaurantConfig.restaurantName;
    } catch (error) {
      logger.error('Error obteniendo configuración del restaurante:', error);
    }
    
    return getGeneralAgentPrompt(restaurantName);
  }
  
  /**
   * Instrucciones para el agente unificado
   */
  private static async getUnifiedAgentInstruction(): Promise<string> {
    let restaurantName = 'nuestro restaurante';
    
    try {
      // Obtener configuración del restaurante
      const { RestaurantService } = await import('../restaurant/RestaurantService');
      const restaurantConfig = await RestaurantService.getConfig();
      restaurantName = restaurantConfig.restaurantName;
    } catch (error) {
      logger.error('Error obteniendo configuración del restaurante:', error);
    }
    
    return getUnifiedAgentPrompt(restaurantName);
  }
  
  /**
   * Instrucciones para el agente de órdenes
   */
  private static getOrderAgentInstruction(relevantMenu: string): string {
    return getOrderAgentPrompt(relevantMenu);
  }
  
  /**
   * Obtiene el menú relevante basado en las palabras clave (con IDs)
   * Delega a MenuSearchService para la lógica de búsqueda
   */
  static async getRelevantMenu(itemsSummary: string): Promise<string> {
    return MenuSearchService.getRelevantMenu(itemsSummary);
  }
}