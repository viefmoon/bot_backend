import { GeminiService } from './GeminiService';
import { Content } from '@google/generative-ai';
import logger from '../../common/utils/logger';

/**
 * Define los tipos de contexto para diferentes operaciones
 */
export enum ContextType {
  GENERAL_CHAT = 'GENERAL_CHAT',
  ORDER_PROCESSING = 'ORDER_PROCESSING',
  MENU_QUERY = 'MENU_QUERY',
}

/**
 * Servicio simplificado para manejar diferentes contextos de conversación
 * Reemplaza el sistema complejo de múltiples agentes
 */
export class AgentService {
  /**
   * Procesa mensajes según el contexto
   */
  static async processMessage(
    messages: Content[],
    contextType: ContextType = ContextType.GENERAL_CHAT,
    additionalContext?: any
  ): Promise<any> {
    try {
      // Obtener instrucciones del sistema según el contexto
      const systemInstruction = await this.getSystemInstruction(contextType, additionalContext);
      
      // Obtener herramientas según el contexto
      const tools = this.getToolsForContext(contextType);
      
      // Procesar con Gemini
      const response = await GeminiService.generateContentWithHistory(
        messages,
        systemInstruction,
        tools
      );
      
      return response;
    } catch (error) {
      logger.error(`AgentService: Error procesando mensaje con contexto ${contextType}`, error);
      throw error;
    }
  }
  
  /**
   * Obtiene las instrucciones del sistema según el contexto
   */
  private static async getSystemInstruction(
    contextType: ContextType,
    additionalContext?: any
  ): Promise<string> {
    const baseInstructions = {
      [ContextType.GENERAL_CHAT]: `
        Eres un asistente amigable para una pizzería.
        Tu objetivo es ayudar a los clientes con sus pedidos y consultas.
        Siempre responde en español de manera cordial y profesional.
        Si el cliente quiere hacer un pedido, usa las herramientas disponibles.
      `,
      
      [ContextType.ORDER_PROCESSING]: `
        Eres un especialista en procesar pedidos de pizzería.
        Debes extraer la información del pedido y mapearla a los productos del menú.
        Sé preciso con las cantidades y especificaciones.
        ${additionalContext?.menuInfo || ''}
      `,
      
      [ContextType.MENU_QUERY]: `
        Eres un experto en el menú de la pizzería.
        Responde preguntas sobre productos, precios e ingredientes.
        Sugiere productos según las preferencias del cliente.
        ${additionalContext?.menuInfo || ''}
      `,
    };
    
    return baseInstructions[contextType] || baseInstructions[ContextType.GENERAL_CHAT];
  }
  
  /**
   * Obtiene las herramientas según el contexto
   */
  private static getToolsForContext(contextType: ContextType): any[] {
    const tools: any[] = [];
    
    switch (contextType) {
      case ContextType.GENERAL_CHAT:
        // Herramientas para chat general
        tools.push({
          functionDeclarations: [
            {
              name: "send_menu",
              description: "Envía el menú completo al usuario",
              parameters: {
                type: "object",
                properties: {}
              }
            },
            {
              name: "route_to_agent",
              description: "Redirige la conversación a un agente especializado",
              parameters: {
                type: "object",
                properties: {
                  targetAgent: {
                    type: "string",
                    enum: ["ORDER_MAPPER_AGENT", "QUERY_AGENT"],
                    description: "Agente objetivo"
                  },
                  conversationSummary: {
                    type: "string",
                    description: "Resumen de la conversación"
                  }
                },
                required: ["targetAgent", "conversationSummary"]
              }
            }
          ]
        });
        break;
        
      case ContextType.ORDER_PROCESSING:
        // Herramientas para procesamiento de pedidos
        tools.push({
          functionDeclarations: [
            {
              name: "map_order_items",
              description: "Mapea los items del pedido a productos del menú",
              parameters: {
                type: "object",
                properties: {
                  orderItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        productId: { type: "string" },
                        variantId: { type: "string" },
                        quantity: { type: "number" },
                        comments: { type: "string" }
                      }
                    }
                  },
                  orderType: {
                    type: "string",
                    enum: ["delivery", "pickup"]
                  },
                  warnings: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["orderItems", "orderType"]
              }
            }
          ]
        });
        break;
        
      case ContextType.MENU_QUERY:
        // Herramientas para consultas del menú
        tools.push({
          functionDeclarations: [
            {
              name: "send_menu",
              description: "Envía el menú completo al usuario",
              parameters: {
                type: "object",
                properties: {}
              }
            }
          ]
        });
        break;
    }
    
    return tools;
  }
  
  /**
   * Método helper para procesar pedidos
   */
  static async processOrder(orderDetails: any[], menuInfo?: string): Promise<any> {
    const messages: Content[] = [{
      role: 'user',
      parts: [{ text: JSON.stringify(orderDetails) }]
    }];
    
    return this.processMessage(
      messages,
      ContextType.ORDER_PROCESSING,
      { menuInfo }
    );
  }
}