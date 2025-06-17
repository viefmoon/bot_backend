import { GeminiService } from './GeminiService';
import logger from '../../common/utils/logger';

// Type definitions for the new SDK
interface Content {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

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
      logger.debug('=== AgentService.processMessage DEBUG ===');
      logger.debug(`Context Type: ${contextType}`);
      logger.debug(`Additional Context: ${additionalContext ? JSON.stringify(additionalContext, null, 2) : 'None'}`);
      logger.debug(`Number of messages: ${messages.length}`);
      
      // Log cada mensaje
      messages.forEach((msg, index) => {
        const messageData = {
          role: msg.role,
          parts: msg.parts.map(p => {
            if ('text' in p) return { type: 'text', content: p.text };
            if ('inlineData' in p) return { type: 'inlineData', mimeType: p.inlineData.mimeType };
            return p;
          })
        };
        logger.debug(`Message ${index + 1}: ${JSON.stringify(messageData, null, 2)}`);
      });
      
      // Obtener instrucciones del sistema según el contexto
      const systemInstruction = await this.getSystemInstruction(contextType, additionalContext);
      logger.debug(`System Instruction: ${systemInstruction}`);
      
      // Obtener herramientas según el contexto
      const tools = this.getToolsForContext(contextType);
      const toolsInfo = tools.map(t => ({ name: t.name, description: t.description }));
      logger.debug(`Tools: ${JSON.stringify(toolsInfo, null, 2)}`);
      
      // Procesar con Gemini
      const response = await GeminiService.generateContentWithHistory(
        messages,
        systemInstruction,
        tools
      );
      
      logger.debug('=== End AgentService.processMessage DEBUG ===');
      
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
    switch (contextType) {
      case ContextType.GENERAL_CHAT:
        // Herramientas para chat general
        return [
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
        ];
        break;
        
      case ContextType.ORDER_PROCESSING:
        // Herramientas para procesamiento de pedidos
        return [
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
        ];
        
      case ContextType.MENU_QUERY:
        // Herramientas para consultas del menú
        return [
          {
            name: "send_menu",
            description: "Envía el menú completo al usuario",
            parameters: {
              type: "object",
              properties: {}
            }
          }
        ];
        
      default:
        return [];
    }
  }
  
  /**
   * Método helper para procesar pedidos
   */
  static async processOrder(orderDetails: any[], menuInfo?: string): Promise<any> {
    logger.debug('=== AgentService.processOrder DEBUG ===');
    logger.debug('Order Details:', JSON.stringify(orderDetails, null, 2));
    logger.debug(`Menu Info provided: ${menuInfo ? 'Yes' : 'No'}`);
    
    const messages: Content[] = [{
      role: 'user',
      parts: [{ text: JSON.stringify(orderDetails) }]
    }];
    
    logger.debug('=== End AgentService.processOrder DEBUG ===');
    
    return this.processMessage(
      messages,
      ContextType.ORDER_PROCESSING,
      { menuInfo }
    );
  }
}