import { MessageStrategy } from './MessageStrategy';
import { MessageContext } from '../MessageContext';
import { AgentService, ContextType } from '../../ai';
import { PreOrderService } from '../../../orders/PreOrderService';
import { sendWhatsAppMessage } from '../../../common/utils/messageSender';
import logger from '../../../common/utils/logger';
import { Content } from '@google/generative-ai';

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
      // Procesar con AI
      const messages: Content[] = relevantChatHistory.map(
        ({ role, content }: any) => ({
          role: role === "assistant" ? "model" : role,
          parts: [{ text: content }]
        })
      );
      
      const response = await AgentService.processMessage(
        messages,
        ContextType.GENERAL_CHAT
      );
      
      // Convertir respuesta al formato esperado
      const aiResponses = await this.processGeminiResponse(response);
      
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
    // Manejar advertencias
    if (preprocessedContent.warnings && preprocessedContent.warnings.length > 0) {
      const warningMessage = "📝 Observaciones:\n" + preprocessedContent.warnings.join("\n");
      await sendWhatsAppMessage(context.message.from, warningMessage);
    }
    
    // Crear pre-orden
    const preOrderService = new PreOrderService();
    const selectProductsResponse = await preOrderService.selectProducts({
      orderItems: preprocessedContent.orderItems,
      customerId: context.message.from,
      orderType: preprocessedContent.orderType,
      scheduledDeliveryTime: preprocessedContent.scheduledDeliveryTime,
    });
    
    // Agregar respuesta de texto
    context.addResponse({
      text: selectProductsResponse.json.text,
      sendToWhatsApp: selectProductsResponse.json.sendToWhatsApp,
      isRelevant: selectProductsResponse.json.isRelevant
    });
    
    // Agregar mensaje interactivo si existe
    if (selectProductsResponse.json.interactiveMessage) {
      context.addResponse({
        interactiveMessage: selectProductsResponse.json.interactiveMessage,
        sendToWhatsApp: true,
        isRelevant: false,
        preOrderId: selectProductsResponse.json.preOrderId
      });
    }
  }
  
  private async processGeminiResponse(response: any): Promise<any[]> {
    const responses: any[] = [];
    
    // Verificar estructura de respuesta válida
    if (!response?.candidates?.[0]?.content?.parts) {
      logger.error('Estructura de respuesta inválida de Gemini API');
      return [{
        text: "Error: Respuesta inválida del modelo",
        isRelevant: true
      }];
    }
    
    // Procesar cada parte de la respuesta
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        // Respuesta de texto simple
        responses.push({
          text: part.text,
          isRelevant: true,
        });
      } else if (part.functionCall) {
        // Procesar function calls
        const functionResponse = await this.handleFunctionCall(
          part.functionCall.name,
          part.functionCall.args
        );
        if (functionResponse) {
          // Si la función retorna un array (múltiples mensajes), agregar todos
          if (Array.isArray(functionResponse)) {
            responses.push(...functionResponse);
          } else {
            responses.push(functionResponse);
          }
        }
      }
    }
    
    return responses;
  }
  
  private async handleFunctionCall(name: string, args: any): Promise<any | null> {
    logger.debug(`Procesando function call: ${name}`, args);
    
    switch (name) {
      case "map_order_items":
        // Procesar mapeo de items del pedido
        return {
          preprocessedContent: {
            orderItems: args.orderItems || [],
            orderType: args.orderType || 'pickup',
            warnings: args.warnings || [],
            scheduledDeliveryTime: args.scheduledDeliveryTime
          }
        };
        
      case "send_menu":
        // Enviar menú
        try {
          const { MenuService } = await import('../../../orders/menu.service');
          const menuService = new MenuService();
          const menu = await menuService.getMenuForAI();
          const menuText = String(menu);
          
          // Si el menú es muy largo, dividirlo en partes
          const maxLength = 4000; // Dejamos margen para WhatsApp
          if (menuText.length > maxLength) {
            const parts = this.splitMenuIntelligently(menuText, maxLength);
            logger.debug(`Menú dividido en ${parts.length} partes`);
            // Retornar múltiples respuestas
            return parts.map((part, index) => ({
              text: part,
              isRelevant: true,
              // Agregar indicador de continuación si no es la última parte
              ...(index < parts.length - 1 && { continuationIndicator: true })
            }));
          }
          
          return {
            text: menuText,
            isRelevant: true
          };
        } catch (error) {
          logger.error('Error obteniendo menú:', error);
          return {
            text: "Lo siento, no pude obtener el menú en este momento.",
            isRelevant: true
          };
        }
        
      default:
        logger.warn(`Function call no reconocido: ${name}`);
        return null;
    }
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