import { MessageStrategy } from './MessageStrategy';
import { MessageContext } from '../MessageContext';
import { AgentService } from '../../ai';
import { PreOrderService } from '../../../services/orders/PreOrderService';
import { sendWhatsAppMessage } from '../../whatsapp';
import logger from '../../../common/utils/logger';

// Type definition for content
interface Content {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export class TextMessageStrategy extends MessageStrategy {
  name = 'TextMessageStrategy';
  
  canHandle(context: MessageContext): boolean {
    return context.message.type === 'text';
  }
  
  async execute(context: MessageContext): Promise<void> {
    if (!context.message.text?.body || !context.customer) return;
    
    const text = context.message.text.body;
    const relevantChatHistory = context.get('relevantChatHistory') || [];
    
    // Agregar mensaje del usuario al historial
    const updateChatHistory = (message: any, isRelevant = true) => {
      const fullHistory = context.get('fullChatHistory') || [];
      fullHistory.push(message);
      context.set('fullChatHistory', fullHistory);
      
      if (isRelevant) {
        relevantChatHistory.push(message);
        context.set('relevantChatHistory', relevantChatHistory);
      }
    };
    
    updateChatHistory(
      { role: "user", content: text, timestamp: new Date() },
      true
    );
    
    try {
      logger.debug('=== TextMessageStrategy.execute DEBUG ===');
      logger.debug('User message:', text);
      logger.debug('Customer ID:', context.customer.customerId);
      logger.debug('Chat history length:', relevantChatHistory.length);
      
      // Procesar con AI
      const messages: Content[] = relevantChatHistory.map(
        ({ role, content }: any) => ({
          role: role === "assistant" ? "model" : role,
          parts: [{ text: content }]
        })
      );
      
      logger.debug(`Messages to send to AI: ${JSON.stringify(messages, null, 2)}`);
      
      const response = await AgentService.processMessage(messages);
      
      logger.debug(`Raw AI response: ${JSON.stringify(response, null, 2)}`);
      
      // Convertir respuesta al formato esperado
      const aiResponses = await this.processGeminiResponse(response);
      
      logger.debug(`Processed AI responses: ${JSON.stringify(aiResponses, null, 2)}`);
      logger.debug('=== End TextMessageStrategy.execute DEBUG ===');
      
      // Procesar respuestas de AI
      for (const response of aiResponses) {
        if (response.text) {
          context.addResponse({
            text: response.text,
            sendToWhatsApp: true,
            isRelevant: response.isRelevant !== false
          });
          
          updateChatHistory(
            { role: "assistant", content: response.text, timestamp: new Date() },
            response.isRelevant !== false
          );
        }
        
        if (response.preprocessedContent) {
          await this.handlePreprocessedContent(context, response.preprocessedContent);
        }
        
        if (response.confirmationMessage) {
          context.addResponse({
            text: response.confirmationMessage,
            sendToWhatsApp: true,
            isRelevant: true
          });
          
          updateChatHistory(
            { role: "assistant", content: response.confirmationMessage, timestamp: new Date() },
            true
          );
        }
      }
    } catch (error) {
      logger.error("Error processing text message:", error);
      context.addResponse({
        text: "Error al procesar la solicitud: " + (error as Error).message,
        sendToWhatsApp: true,
        isRelevant: true
      });
    }
  }
  
  private async handlePreprocessedContent(context: MessageContext, preprocessedContent: any): Promise<void> {
    // Handle warnings
    if (preprocessedContent.warnings && preprocessedContent.warnings.length > 0) {
      const warningMessage = "📝 Observaciones:\n" + preprocessedContent.warnings.join("\n");
      await sendWhatsAppMessage(context.message.from, warningMessage);
    }
    
    // Create pre-order
    const preOrderService = new PreOrderService();
    const preOrderResult = await preOrderService.selectProducts({
      orderItems: preprocessedContent.orderItems,
      customerId: context.message.from,
      orderType: preprocessedContent.orderType,
      scheduledDeliveryTime: preprocessedContent.scheduledDeliveryTime,
    });
    
    // Generate order summary
    const { generateOrderSummary } = await import('../../../whatsapp/handlers/orders/orderFormatters');
    const orderSummary = generateOrderSummary(preOrderResult);
    
    // Send order summary
    await sendWhatsAppMessage(context.message.from, orderSummary);
    
    // Add interactive confirmation message
    context.addResponse({
      interactiveMessage: {
        type: "button",
        body: {
          text: "¿Deseas confirmar tu pedido?"
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: `confirm_order_${preOrderResult.preOrderId}`,
                title: "✅ Confirmar"
              }
            },
            {
              type: "reply",
              reply: {
                id: `discard_order_${preOrderResult.preOrderId}`,
                title: "❌ Cancelar"
              }
            }
          ]
        }
      },
      sendToWhatsApp: true,
      isRelevant: false,
      preOrderId: preOrderResult.preOrderId
    });
  }
  
  private async processGeminiResponse(response: any): Promise<any[]> {
    logger.debug('=== processGeminiResponse DEBUG ===');
    const responses: any[] = [];
    
    // Verificar estructura de respuesta válida
    if (!response?.candidates?.[0]?.content?.parts) {
      logger.error('Estructura de respuesta inválida de Gemini API');
      logger.debug('Response structure:', {
        hasCandidate: !!response?.candidates?.[0],
        hasContent: !!response?.candidates?.[0]?.content,
        hasParts: !!response?.candidates?.[0]?.content?.parts
      });
      return [{
        text: "Error: Respuesta inválida del modelo",
        isRelevant: true
      }];
    }
    
    const parts = response.candidates[0].content.parts;
    logger.debug(`Processing ${parts.length} parts from response`);
    
    // Procesar cada parte de la respuesta
    for (const part of parts) {
      const partInfo = {
        hasText: !!part.text,
        hasFunctionCall: !!part.functionCall,
        functionName: part.functionCall?.name
      };
      logger.debug(`Processing part: ${JSON.stringify(partInfo)}`);
      
      if (part.text) {
        // Respuesta de texto simple
        logger.debug('Text response:', part.text);
        responses.push({
          text: part.text,
          isRelevant: true,
        });
      } else if (part.functionCall) {
        // Procesar function calls
        const functionInfo = {
          name: part.functionCall.name,
          args: part.functionCall.args
        };
        logger.debug(`Function call: ${JSON.stringify(functionInfo, null, 2)}`);
        
        const functionResponse = await this.handleFunctionCall(
          part.functionCall.name,
          part.functionCall.args
        );
        if (functionResponse) {
          // Si la función retorna un array (múltiples mensajes), agregar todos
          if (Array.isArray(functionResponse)) {
            logger.debug(`Function returned ${functionResponse.length} responses`);
            responses.push(...functionResponse);
          } else {
            logger.debug('Function returned single response');
            responses.push(functionResponse);
          }
        }
      }
    }
    
    logger.debug(`Total responses processed: ${responses.length}`);
    logger.debug('=== End processGeminiResponse DEBUG ===');
    
    return responses;
  }
  
  private async handleFunctionCall(name: string, args: any): Promise<any | null> {
    logger.debug('=== handleFunctionCall DEBUG ===');
    logger.debug(`Function name: ${name}`);
    logger.debug('Function args:', JSON.stringify(args, null, 2));
    
    let result: any = null;
    
    switch (name) {
      case "map_order_items":
        // Procesar mapeo de items del pedido
        result = {
          preprocessedContent: {
            orderItems: args.orderItems || [],
            orderType: args.orderType || 'pickup',
            warnings: args.warnings || [],
            scheduledDeliveryTime: args.scheduledDeliveryTime
          }
        };
        break;
        
      case "send_menu":
        // Enviar menú
        try {
          const { ProductService } = await import('../../products/ProductService');
          const menu = await ProductService.getActiveProducts({ formatForAI: true });
          const menuText = String(menu);
          
          // Si el menú es muy largo, dividirlo en partes
          const maxLength = 4000; // Dejamos margen para WhatsApp
          if (menuText.length > maxLength) {
            const parts = this.splitMenuIntelligently(menuText, maxLength);
            logger.debug(`Menú dividido en ${parts.length} partes`);
            // Retornar múltiples respuestas
            result = parts.map((part, index) => ({
              text: part,
              isRelevant: true,
              // Agregar indicador de continuación si no es la última parte
              ...(index < parts.length - 1 && { continuationIndicator: true })
            }));
          } else {
            result = {
              text: menuText,
              isRelevant: true
            };
          }
        } catch (error) {
          logger.error('Error obteniendo menú:', error);
          result = {
            text: "Lo siento, no pude obtener el menú en este momento.",
            isRelevant: true
          };
        }
        break;
        
      case "get_business_hours":
        // Obtener horario de atención
        try {
          const { RestaurantService } = await import('../../../services/restaurant/RestaurantService');
          const businessHours = await RestaurantService.getAllBusinessHours();
          
          const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          let hoursText = "🕐 *Horario de Atención*\n\n";
          
          for (const hours of businessHours) {
            const day = daysOfWeek[hours.dayOfWeek];
            if (hours.isClosed) {
              hoursText += `${day}: Cerrado\n`;
            } else {
              hoursText += `${day}: ${hours.openingTime} - ${hours.closingTime}\n`;
            }
          }
          
          result = {
            text: hoursText.trim(),
            isRelevant: true
          };
        } catch (error) {
          logger.error('Error obteniendo horario:', error);
          result = {
            text: "Lo siento, no pude obtener el horario de atención en este momento.",
            isRelevant: true
          };
        }
        break;
        
      default:
        logger.warn(`Function call no reconocido: ${name}`);
    }
    
    logger.debug('Function call result:', JSON.stringify(result, null, 2));
    logger.debug('=== End handleFunctionCall DEBUG ===');
    return result;
  }
  
  private splitMenuIntelligently(text: string, maxLength: number): string[] {
    const parts: string[] = [];
    const lines = text.split('\n');
    let currentPart = '';
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detectar si es un encabezado de categoría (ej: "🍕 PIZZAS", "🥤 BEBIDAS")
      const isCategoryHeader = line.match(/^[🍕🍔🥤🍗🥗🍝🍰🌮🥟🍛]|^[A-Z\s]{3,}:|^\*\*.*\*\*$/);
      
      // Si encontramos un nuevo encabezado de categoría y el parte actual + sección actual excede el límite
      if (isCategoryHeader && currentSection && (currentPart.length + currentSection.length > maxLength)) {
        // Guardar la parte actual si tiene contenido
        if (currentPart.trim()) {
          parts.push(currentPart.trim());
        }
        currentPart = currentSection;
        currentSection = line + '\n';
      } else if (currentPart.length + line.length + 1 > maxLength) {
        // Si agregar la línea actual excedería el límite
        
        // Si la parte actual está vacía pero la línea es muy larga, dividirla
        if (!currentPart.trim() && line.length > maxLength) {
          // Dividir por palabras para no cortar a la mitad
          const words = line.split(' ');
          let tempLine = '';
          
          for (const word of words) {
            if (tempLine.length + word.length + 1 <= maxLength) {
              tempLine += (tempLine ? ' ' : '') + word;
            } else {
              if (tempLine) parts.push(tempLine);
              tempLine = word;
            }
          }
          if (tempLine) currentPart = tempLine + '\n';
        } else {
          // Guardar la parte actual y empezar una nueva
          parts.push(currentPart.trim());
          currentPart = currentSection + line + '\n';
          currentSection = '';
        }
      } else {
        // Agregar línea a la sección actual
        currentSection += line + '\n';
      }
    }
    
    // Agregar cualquier contenido restante
    if (currentSection) {
      currentPart += currentSection;
    }
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    // No agregar indicadores de continuación
    
    return parts;
  }
}