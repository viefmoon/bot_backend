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
  orderType?: string;
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
      // Usar el agente general para detectar intención
      const systemInstruction = await this.getGeneralAgentInstruction();
      const tools = this.getGeneralAgentTools();
      
      // Log completo de lo que recibe el modelo
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
      const startTime = Date.now();
      logger.debug('=== AgentService.processOrderMapping (ORDER_AGENT) ===');
      logger.debug('Order Context:', {
        itemsSummary: orderContext.itemsSummary,
        menuLength: orderContext.relevantMenu.length
      });
      
      // Crear mensaje para el agente de órdenes
      const messages: Content[] = [{
        role: 'user',
        parts: [{ 
          text: `ORDEN: ${orderContext.itemsSummary}\nTIPO: ${orderContext.orderType || 'DELIVERY'}\nMENÚ: ${orderContext.relevantMenu}` 
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
      
      // Log completo de lo que recibe el modelo de órdenes
      logger.debug('=== COMPLETE ORDER AGENT INPUT ===');
      logger.debug(`System Instruction:\n${systemInstruction}`);
      (logger as any).json('Messages:', messages);
      (logger as any).json('Tools:', tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      })));
      (logger as any).json('Tool Config:', toolConfig);
      logger.debug('=== END ORDER AGENT INPUT ===');
      
      logger.info('Calling Gemini API for order processing...');
      const geminiStartTime = Date.now();
      
      const response = await GeminiService.generateContentWithHistory(
        messages,
        systemInstruction,
        tools,
        toolConfig
      );
      
      const geminiTime = Date.now() - geminiStartTime;
      const totalTime = Date.now() - startTime;
      
      logger.info(`Order agent timing breakdown:`, {
        geminiApiTime: `${geminiTime}ms`,
        totalProcessingTime: `${totalTime}ms`,
        overheadTime: `${totalTime - geminiTime}ms`
      });
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
    let menuJson = '{}';
    let restaurantName = 'nuestro restaurante';
    
    try {
      // Obtener estructura del menú
      const menuStructure = await ProductService.getMenuStructureForAI();
      menuJson = JSON.stringify(menuStructure, null, 2);
    } catch (error) {
      logger.error('Error obteniendo estructura del menú para AI:', error);
    }
    
    try {
      // Obtener configuración del restaurante
      const { RestaurantService } = await import('../restaurant/RestaurantService');
      const restaurantConfig = await RestaurantService.getConfig();
      restaurantName = restaurantConfig.restaurantName;
    } catch (error) {
      logger.error('Error obteniendo configuración del restaurante:', error);
    }
    
    return `
      Eres un asistente virtual de ${restaurantName}. Tu función es ayudar a los clientes con sus consultas y pedidos.
      
      REGLAS ESTRICTAS:
      - SOLO puedes proporcionar información que está en tu contexto o usar las herramientas disponibles
      - NO inventes información sobre productos, precios, ingredientes o disponibilidad
      - NO asumas o adivines características de productos que no están en tu contexto
      - Si no tienes información específica, indica al cliente que no dispones de esa información
      - NUNCA proporciones precios individuales, solo a través de la herramienta "send_menu"
      
      1. DETECTAR INTENCIÓN:
         - Si el cliente quiere ordenar algo, usa la herramienta "prepare_order_context"
         - Si es una consulta general, responde directamente
      
      2. CONSULTAS GENERALES:
         - Menú completo con precios: usa "send_menu" 
         - Información del restaurante: usa "get_business_hours"
         - Tiempos de espera: usa "get_wait_times"
         - Actualizar dirección: usa "generate_address_update_link"
         - Instrucciones del bot: usa "send_bot_instructions"
         - Para otras consultas: responde SOLO con información disponible en tu contexto
      
      3. DETECCIÓN DE ÓRDENES:
         Cuando detectes intención de ordenar (palabras clave: quiero, pedir, ordenar, dame, tráeme, etc.):
         
         PRIMERO: Verifica el tipo de orden
         - Si el cliente NO ha especificado si es para llevar o entrega a domicilio:
           * PREGUNTA: "¿Tu pedido es para entrega a domicilio o para recoger en el restaurante?"
           * NO ejecutes "prepare_order_context" hasta tener esta información
         
         - Detecta el tipo de orden SOLO cuando el cliente lo especifique:
           * DELIVERY: "a domicilio", "envío", "traer", "mi casa", "mi dirección", "que me lo traigan"
           * TAKE_AWAY: "para llevar", "recoger", "paso por", "voy por", "lo recojo"
         
         DESPUÉS de confirmar el tipo de orden:
         - Extrae TODOS los artículos mencionados
         - Incluye cantidades si las menciona
         - USA "prepare_order_context" con el tipo de orden confirmado
         
         NUNCA asumas el tipo de orden - SIEMPRE debe ser especificado por el cliente
      
      4. ACTUALIZACIÓN DE DIRECCIÓN:
         Si el cliente quiere actualizar su dirección o agregar una nueva dirección de entrega:
         - Usa "generate_address_update_link" para generar un enlace seguro
         - NO agregues mensajes adicionales, la herramienta ya envía el mensaje interactivo
      
      5. INSTRUCCIONES DEL BOT:
         Si el cliente pregunta cómo usar el bot, cómo funciona, qué puede hacer, o necesita ayuda:
         - Usa "send_bot_instructions" para enviar las instrucciones completas
         - Detecta preguntas como: "cómo usar", "cómo funciona", "qué puedo hacer", "ayuda", "tutorial", "instrucciones"
      
      6. RESETEAR CONVERSACIÓN:
         Si el cliente quiere reiniciar la conversación o borrar el historial:
         - Usa "reset_conversation" para limpiar el contexto
         - Detecta frases como: "olvida lo anterior", "reinicia la conversación", "borra el historial", "empecemos de nuevo", "olvida todo", "reinicia el chat"
      
      LIMITACIONES Y RESTRICCIONES:
      - Solo puedes responder sobre productos que existen en el menú
      - No puedes inventar o sugerir productos que no están disponibles
      - No puedes modificar ingredientes base de los productos
      - No puedes prometer tiempos de entrega específicos fuera de los establecidos
      - No puedes ofrecer descuentos o promociones no autorizadas
      - Si el cliente pide algo que no está en el menú, debes indicarlo claramente
      
      MANEJO DE ERRORES:
      - Si no entiendes la solicitud: pide aclaración de manera amable
      - Si el producto no existe: sugiere alternativas del menú disponible
      - Si hay ambigüedad: pregunta para confirmar antes de proceder
      
      IMPORTANTE:
      - Responde siempre en español
      - Sé cordial y profesional pero mantente dentro de tus capacidades
      - Para órdenes, NO intentes mapear productos, solo extrae lo que el cliente dice
      - NUNCA proporciones precios individuales bajo ninguna circunstancia
      - Si preguntan por precios, SIEMPRE ejecuta "send_menu"
      
      ESTRUCTURA DEL MENÚ DISPONIBLE:
      ${menuJson}
      
      Esta estructura muestra TODO lo que puedes ofrecer. Si algo no está aquí, NO lo ofrezcas.
      Úsala para validar las solicitudes del cliente y sugerir alternativas válidas.
    `;
  }
  
  /**
   * Instrucciones para el agente de órdenes
   */
  private static getOrderAgentInstruction(): string {
    return `MAPEA LA ORDEN AL MENÚ JSON.
    
ESTRUCTURA DEL MENÚ:
- id: ID del producto
- nombre: nombre del producto
- variantes: array con {id, nombre, precio}
- modificadores: grupos con opciones {id, nombre, precio}
- ingredientesPizza: para pizzas {id, nombre}

EJECUTA map_order_items con:
- productId: usa el id del producto
- variantId: usa el id de la variante correcta (si aplica)
- quantity: cantidad solicitada
- modifiers: array de IDs de modificadores (si aplica)
- pizzaIngredients: array de IDs de ingredientes (si es pizza)
- orderType: USA EL TIPO DE ORDEN QUE VIENE EN EL MENSAJE (DESPUÉS DE "TIPO:")

IMPORTANTE: NO CAMBIES EL TIPO DE ORDEN. USA EXACTAMENTE EL QUE ESTÁ EN EL MENSAJE.

NO CONVERSES. SOLO MAPEA Y EJECUTA.`;
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
        description: "Obtiene información completa del restaurante incluyendo ubicación, teléfonos y horarios",
        parameters: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_wait_times",
        description: "Obtiene los tiempos de espera estimados para recolección y entrega a domicilio",
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
            orderType: {
              type: "string", 
              enum: ["DELIVERY", "TAKE_AWAY"],
              description: "Tipo de orden: DELIVERY (entrega a domicilio), TAKE_AWAY (para llevar/recoger)"
            }
          },
          required: ["itemsSummary", "orderType"]
        }
      },
      {
        name: "generate_address_update_link",
        description: "Genera un enlace seguro para que el cliente actualice o agregue una dirección de entrega",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Razón por la cual el cliente quiere actualizar la dirección"
            }
          }
        }
      },
      {
        name: "send_bot_instructions",
        description: "Envía las instrucciones completas de cómo usar el bot cuando el cliente lo solicite",
        parameters: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "reset_conversation",
        description: "Reinicia la conversación y borra el historial relevante cuando el cliente lo solicite",
        parameters: {
          type: "object",
          properties: {}
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
        description: "Mapear items del pedido",
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
                  modifiers: { type: "array", items: { type: "string" } },
                  pizzaIngredients: { type: "array", items: { type: "string" } }
                },
                required: ["productId", "quantity"]
              }
            },
            orderType: {
              type: "string",
              enum: ["DELIVERY", "TAKE_AWAY"]
            },
            warnings: { type: "string" }
          },
          required: ["orderItems", "orderType"]
        }
      }
    ];
  }
  
  /**
   * Obtiene el menú relevante basado en las palabras clave (con IDs)
   */
  static async getRelevantMenu(itemsSummary: string): Promise<string> {
    try {
      const stringSimilarity = await import('string-similarity');
      
      logger.debug(`Getting relevant menu for: "${itemsSummary}"`);
      
      // Obtener productos con todas sus relaciones
      const products = await ProductService.getActiveProducts({ includeRelations: true }) as any[];
      
      // Normalizar texto de búsqueda
      const normalizeText = (text: string): string => {
        return text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove accents
          .replace(/[^\w\s]/g, ' ') // Replace non-word chars with space
          .replace(/\s+/g, ' ') // Multiple spaces to single
          .trim();
      };
      
      const normalizedSummary = normalizeText(itemsSummary);
      
      logger.debug(`Normalized search: "${normalizedSummary}"`);
      
      // Score each product based on similarity
      const scoredProducts = products.map(product => {
        const productName = normalizeText(product.name || '');
        const productDesc = normalizeText(product.description || '');
        const categoryName = normalizeText(product.subcategory?.category?.name || '');
        const subcategoryName = normalizeText(product.subcategory?.name || '');
        
        // Create searchable combinations
        const searchTargets = [
          productName, // Highest priority
          `${productName} ${categoryName}`,
          `${productName} ${subcategoryName}`,
          `${productName} ${productDesc}`,
        ];
        
        // Calculate similarity scores for each target
        const similarities = searchTargets.map(target => 
          stringSimilarity.compareTwoStrings(normalizedSummary, target)
        );
        
        // Get best match score
        const bestScore = Math.max(...similarities);
        
        // Additional scoring for partial matches
        let bonusScore = 0;
        
        // Check if any word from the summary appears in the product name
        const summaryWords = normalizedSummary.split(' ').filter(w => w.length > 2);
        const productWords = productName.split(' ');
        
        summaryWords.forEach(summaryWord => {
          productWords.forEach(productWord => {
            const wordSimilarity = stringSimilarity.compareTwoStrings(summaryWord, productWord);
            if (wordSimilarity > 0.8) { // 80% similarity threshold for individual words
              bonusScore += 0.2;
            }
          });
        });
        
        const finalScore = bestScore + bonusScore;
        
        return { 
          product, 
          score: finalScore,
          debug: {
            productName,
            bestScore,
            bonusScore,
            finalScore
          }
        };
      });
      
      // Filter and sort by score
      const relevantProducts = scoredProducts
        .filter(item => item.score > 0.3) // 30% similarity threshold
        .sort((a, b) => b.score - a.score);
      
      // Log top matches for debugging
      logger.debug(`Top matches:`);
      relevantProducts.slice(0, 5).forEach((item, index) => {
        logger.debug(`${index + 1}. ${item.debug.productName} (score: ${item.score.toFixed(3)})`);
      });
      
      // If no good matches, use a more lenient threshold
      if (relevantProducts.length === 0) {
        logger.debug('No products found with 30% threshold, trying 20%...');
        const lenientMatches = scoredProducts
          .filter(item => item.score > 0.2)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
          
        if (lenientMatches.length > 0) {
          relevantProducts.push(...lenientMatches);
        }
      }
      
      // Build complete menu structure with all relations
      const menuStructure = relevantProducts
        .slice(0, 15)
        .map(item => item.product)
        .map(product => {
          const item: any = {
            id: product.id,
            nombre: product.name,
          };
          
          // Include variants with full info
          if (product.variants?.length > 0) {
            item.variantes = product.variants.map((v: any) => ({
              id: v.id,
              nombre: v.name,
              precio: v.price
            }));
          }
          
          // Include modifiers if they exist
          if (product.modifierGroups?.length > 0) {
            item.modificadores = product.modifierGroups
              .filter((g: any) => g.productModifiers?.length > 0)
              .map((group: any) => ({
                grupo: group.name,
                requerido: group.required,
                multiple: group.acceptsMultiple,
                opciones: group.productModifiers.map((m: any) => ({
                  id: m.id,
                  nombre: m.name,
                  precio: m.price
                }))
              }));
          }
          
          // Include pizza ingredients if it's a pizza
          if (product.isPizza && product.pizzaIngredients?.length > 0) {
            item.ingredientesPizza = product.pizzaIngredients.map((i: any) => ({
              id: i.id,
              nombre: i.name
            }));
          }
          
          return item;
        });
      
      // Log the menu structure in a readable format
      logger.debug(`Returning ${menuStructure.length} relevant products`);
      if (menuStructure.length > 0) {
        (logger as any).json('Relevant menu structure:', menuStructure);
      }
      
      return JSON.stringify(menuStructure);
    } catch (error) {
      logger.error('Error obteniendo menú relevante:', error);
      return "[]";
    }
  }
}