import { GeminiService } from './GeminiService';
import logger from '../../common/utils/logger';

// Type definitions for the new SDK
interface Content {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

/**
 * Servicio unificado de AI para manejar todas las conversaciones
 */
export class AgentService {
  /**
   * Procesa mensajes con el asistente unificado
   */
  static async processMessage(
    messages: Content[],
    additionalContext?: any
  ): Promise<any> {
    try {
      logger.debug('=== AgentService.processMessage DEBUG ===');
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
      
      // Obtener instrucciones del sistema
      const systemInstruction = await this.getSystemInstruction(additionalContext);
      logger.debug(`System Instruction: ${systemInstruction}`);
      
      // Obtener herramientas disponibles
      const tools = this.getTools();
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
      logger.error('AgentService: Error procesando mensaje', error);
      throw error;
    }
  }
  
  /**
   * Obtiene las instrucciones del sistema
   */
  private static async getSystemInstruction(
    additionalContext?: any
  ): Promise<string> {
    // Obtener el menú para incluirlo en las instrucciones
    let menuInfo = '';
    if (additionalContext?.menuInfo) {
      menuInfo = additionalContext.menuInfo;
    } else {
      try {
        const { ProductService } = await import('../products/ProductService');
        const menu = await ProductService.getActiveProducts({ formatForAI: true });
        menuInfo = String(menu);
      } catch (error) {
        logger.error('Error obteniendo menú para instrucciones:', error);
      }
    }
    
    return `
      Eres un asistente completo para una pizzería que puede:
      1. Responder preguntas generales de manera amigable
      2. Procesar pedidos de comida
      3. Proporcionar información sobre el menú
      4. Mostrar el horario de atención del negocio
      
      IMPORTANTE:
      - Siempre responde en español de manera cordial y profesional
      - Cuando un cliente quiera ordenar, usa la herramienta map_order_items que generara la orden que el cliente debera aceptar
      - Sé preciso con las cantidades y especificaciones
      - Si no entiendes algo, pregunta para clarificar
      - Confirma siempre los detalles del pedido antes de procesarlo
      
      MENÚ DISPONIBLE:
      ${menuInfo}
      
      Cuando proceses un pedido:
      - Mapea correctamente los items solicitados a los productId y variantId del menú
      - Si un producto no está claro, sugiere opciones similares
      - Incluye comentarios especiales del cliente
      - Determina si es para entrega (delivery) o recoger (pickup)
    `;
  }
  
  /**
   * Obtiene todas las herramientas disponibles
   */
  private static getTools(): any[] {
    // Todas las herramientas disponibles para el asistente unificado
    return [
      {
        name: "send_menu",
        description: "Envía el menú completo al usuario cuando lo solicite",
        parameters: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "map_order_items",
        description: "Procesa y mapea los items del pedido a productos del menú",
        parameters: {
          type: "object",
          properties: {
            orderItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: { 
                    type: "string",
                    description: "ID del producto del menú"
                  },
                  variantId: { 
                    type: "string",
                    description: "ID de la variante (tamaño/tipo)"
                  },
                  quantity: { 
                    type: "number",
                    description: "Cantidad a ordenar"
                  },
                  comments: { 
                    type: "string",
                    description: "Comentarios especiales del cliente"
                  }
                },
                required: ["productId", "quantity"]
              },
              description: "Lista de productos a ordenar"
            },
            orderType: {
              type: "string",
              enum: ["delivery", "pickup"],
              description: "Tipo de pedido: entrega a domicilio o recoger en tienda"
            },
            warnings: {
              type: "array",
              items: { type: "string" },
              description: "Advertencias o aclaraciones sobre el pedido"
            },
            scheduledDeliveryTime: {
              type: "string",
              description: "Hora programada para entrega/recogida (opcional)"
            }
          },
          required: ["orderItems", "orderType"]
        }
      },
      {
        name: "get_business_hours",
        description: "Obtiene el horario de atención del negocio",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    ];
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
      { menuInfo }
    );
  }
}