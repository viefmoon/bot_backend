import { GeminiService } from './GeminiService';
import logger from '../../common/utils/logger';
import { ProductService } from '../products/ProductService';

// Type definitions for the new SDK
interface Content {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

// Contexto para el agente de órdenes
interface OrderContext {
  itemsSummary: string;
  relevantMenu: string;
}

/**
 * Servicio de AI con agentes especializados
 */
export class AgentService {
  /**
   * Procesa mensajes con el agente general
   */
  static async processMessage(
    messages: Content[]
  ): Promise<any> {
    try {
      logger.debug('=== AgentService.processMessage (GENERAL_AGENT) ===');
      
      // Usar el agente general para detectar intención
      const systemInstruction = await this.getGeneralAgentInstruction();
      const tools = this.getGeneralAgentTools();
      
      const response = await GeminiService.generateContentWithHistory(
        messages,
        systemInstruction,
        tools
      );
      
      logger.debug('=== End GENERAL_AGENT Processing ===');
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
      logger.debug('=== AgentService.processOrderMapping (ORDER_AGENT) ===');
      logger.debug('Order Context:', orderContext);
      
      // Crear mensaje para el agente de órdenes
      const messages: Content[] = [{
        role: 'user',
        parts: [{ 
          text: `Cliente quiere ordenar: ${orderContext.itemsSummary}\n\nMenú relevante:\n${orderContext.relevantMenu}` 
        }]
      }];
      
      const systemInstruction = this.getOrderAgentInstruction();
      const tools = this.getOrderAgentTools();
      
      // Configurar modo ANY para forzar la ejecución de función
      const toolConfig = {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: ['map_order_items']
        }
      };
      
      const response = await GeminiService.generateContentWithHistory(
        messages,
        systemInstruction,
        tools,
        toolConfig
      );
      
      logger.debug('=== End ORDER_AGENT Processing ===');
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
    return `
      Eres un asistente amigable de una pizzería. Tu rol principal es:
      
      1. DETECTAR INTENCIÓN:
         - Si el cliente quiere ordenar algo, usa la herramienta "prepare_order_context"
         - Si es una consulta general, responde directamente
      
      2. CONSULTAS GENERALES:
         - Información sobre el menú: usa "send_menu"
         - Horarios: usa "get_business_hours"
         - Preguntas generales: responde de forma amigable
      
      3. DETECCIÓN DE ÓRDENES:
         Cuando detectes que el cliente quiere ordenar (palabras como: quiero, pedir, ordenar, dame, etc.):
         - Extrae TODOS los artículos mencionados
         - Incluye cantidades si las menciona
         - Detecta el tipo de orden:
           * DELIVERY: si menciona "a domicilio", "envío", "traer", "mi casa", "mi dirección" (POR DEFECTO)
           * TAKE_AWAY: si menciona "para llevar", "recoger", "paso por", "voy por"
           * DINE_IN: si menciona "comer ahí", "en el restaurante", "mesa"
           * Por defecto usa DELIVERY si no está claro
         - USA SIEMPRE "prepare_order_context" para pasar al agente de órdenes
      
      IMPORTANTE:
      - Responde siempre en español
      - Sé cordial y profesional
      - Para órdenes, NO intentes mapear productos, solo extrae lo que el cliente dice
    `;
  }
  
  /**
   * Instrucciones para el agente de órdenes
   */
  private static getOrderAgentInstruction(): string {
    return `
      Eres un agente especializado en mapear órdenes. Tu ÚNICA función es:
      
      1. Recibir el resumen de lo que el cliente quiere
      2. Mapear cada item al menú proporcionado
      3. SIEMPRE ejecutar "map_order_items" con el resultado
      
      REGLAS ESTRICTAS:
      - DEBES usar la herramienta "map_order_items" SIEMPRE
      - Mapea con precisión usando productId y variantId del menú
      - Si algo no está claro, incluye una advertencia
      - Detecta el tipo de orden: DELIVERY (entrega), TAKE_AWAY (para llevar), DINE_IN (comer aquí)
      
      NO HAGAS:
      - No converses con el cliente
      - No pidas aclaraciones
      - No respondas sin usar la herramienta
      
      SOLO ejecuta la función con el mapeo correcto.
    `;
  }
  
  /**
   * Herramientas para el agente general
   */
  private static getGeneralAgentTools(): any[] {
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
        name: "get_business_hours",
        description: "Obtiene el horario de atención del negocio",
        parameters: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "prepare_order_context",
        description: "Prepara el contexto para procesar una orden cuando el cliente quiere pedir algo",
        parameters: {
          type: "object",
          properties: {
            itemsSummary: {
              type: "string",
              description: "Lista de todos los artículos que el cliente mencionó (ej: '2 pizzas hawaianas grandes, 1 coca cola, papas fritas')"
            },
            detectedOrderType: {
              type: "string", 
              enum: ["DELIVERY", "TAKE_AWAY", "DINE_IN"],
              description: "Tipo de orden detectado si el cliente lo mencionó"
            },
            specialInstructions: {
              type: "string",
              description: "Instrucciones especiales del cliente si las hay"
            }
          },
          required: ["itemsSummary"]
        }
      }
    ];
  }
  
  /**
   * Herramientas para el agente de órdenes
   */
  private static getOrderAgentTools(): any[] {
    return [
      {
        name: "map_order_items",
        description: "SIEMPRE usa esta herramienta para mapear los items del pedido",
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
                  }
                },
                required: ["productId", "quantity"]
              }
            },
            orderType: {
              type: "string",
              enum: ["DELIVERY", "TAKE_AWAY", "DINE_IN"],
              description: "Tipo de pedido: DELIVERY (entrega), TAKE_AWAY (para llevar), DINE_IN (comer en el lugar)"
            },
            warnings: {
              type: "string",
              description: "Advertencias o errores generales sobre el procesamiento del pedido"
            }
          },
          required: ["orderItems", "orderType"]
        }
      }
    ];
  }
  
  /**
   * Obtiene el menú relevante basado en las palabras clave
   */
  static async getRelevantMenu(itemsSummary: string): Promise<string> {
    try {
      // Obtener menú completo
      const fullMenu = await ProductService.getActiveProducts({ formatForAI: true });
      const menuStr = String(fullMenu);
      
      // Palabras clave del resumen (normalizado)
      const keywords = itemsSummary
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2);
      
      // Filtrar líneas del menú que contengan palabras clave
      const menuLines = menuStr.split('\n');
      const relevantLines: string[] = [];
      let currentCategory = '';
      
      for (const line of menuLines) {
        const lineLower = line.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Detectar categorías
        if (line.startsWith('##') || line.startsWith('📋')) {
          currentCategory = line;
          continue;
        }
        
        // Verificar si la línea contiene alguna palabra clave
        const isRelevant = keywords.some(keyword => lineLower.includes(keyword));
        
        if (isRelevant) {
          // Agregar categoría si no está
          if (currentCategory && !relevantLines.includes(currentCategory)) {
            relevantLines.push(currentCategory);
          }
          relevantLines.push(line);
        }
      }
      
      // Si no encontramos líneas relevantes, incluir categorías populares
      if (relevantLines.length === 0) {
        const popularCategories = ['pizza', 'hamburguesa', 'bebida', 'combo'];
        for (const line of menuLines) {
          const lineLower = line.toLowerCase();
          if (popularCategories.some(cat => lineLower.includes(cat))) {
            relevantLines.push(line);
          }
        }
      }
      
      // Si aún no hay resultados, devolver un extracto del menú
      if (relevantLines.length === 0) {
        return menuLines.slice(0, 50).join('\n');
      }
      
      return relevantLines.join('\n');
    } catch (error) {
      logger.error('Error obteniendo menú relevante:', error);
      // En caso de error, devolver menú completo
      const menu = await ProductService.getActiveProducts({ formatForAI: true });
      return String(menu);
    }
  }
}