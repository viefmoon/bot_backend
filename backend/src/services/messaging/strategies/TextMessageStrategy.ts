import { MessageStrategy } from './MessageStrategy';
import { MessageContext } from '../MessageContext';
import { AgentService } from '../../ai';
import { PreOrderWorkflowService } from '../../../services/orders/PreOrderWorkflowService';
import { sendWhatsAppMessage } from '../../whatsapp';
import logger from '../../../common/utils/logger';
import { MessageSplitter } from '../../../common/utils/messageSplitter';
import { ProcessedOrderData } from '../../../common/types/preorder.types';
import { AIOrderItem, transformAIOrderItem } from '../../../common/types';
import { ValidationError, BusinessLogicError, TechnicalError } from '../../../common/services/errors';

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
    let relevantChatHistory = context.get('relevantChatHistory') || [];
    
    // Crear una copia para trabajar que incluya el mensaje actual
    const workingHistory = [...relevantChatHistory];
    
    workingHistory.push({ role: "user", content: text });
    
    try {
      // Procesar con AI - usar workingHistory que incluye el mensaje actual
      const messages: Content[] = workingHistory.map(
        ({ role, content }: any) => ({
          role: role === "assistant" ? "model" : role,
          parts: [{ text: content }]
        })
      );
      
      logger.debug('Calling AgentService.processMessage with messages:', messages);
      const response = await AgentService.processMessage(messages);
      logger.debug('AgentService response:', JSON.stringify(response, null, 2));
      
      // Convertir respuesta al formato esperado
      const aiResponses = await this.processGeminiResponse(response, context);
      
      // Procesar respuestas de AI
      for (const response of aiResponses) {
        if (response.text) {
          context.addResponse({
            text: response.text,
            sendToWhatsApp: response.sendToWhatsApp !== false,
            isRelevant: response.isRelevant !== false,
            historyMarker: response.historyMarker // Pasar el marcador de historial si existe
          });
        }
        
        if (response.urlButton) {
          // Manejar mensaje con botón URL
          const { sendMessageWithUrlButton } = await import('../../whatsapp');
          await sendMessageWithUrlButton(
            context.message.from,
            response.urlButton.title,
            response.urlButton.body,
            response.urlButton.buttonText,
            response.urlButton.url
          );
          
          // Agregar al contexto para que se guarde en el historial
          context.addResponse({
            text: `${response.urlButton.title}\n\n${response.urlButton.body}`,
            sendToWhatsApp: false, // Ya se envió con sendMessageWithUrlButton
            isRelevant: response.isRelevant !== false
          });
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
    try {
      // Handle warnings
      if (preprocessedContent.warnings && preprocessedContent.warnings.length > 0) {
        const warningMessage = "📝 Observaciones:\n" + preprocessedContent.warnings.join("\n");
        await sendWhatsAppMessage(context.message.from, warningMessage);
        
        // Agregar las observaciones al contexto para que se guarden en el historial relevante
        context.addResponse({
          text: warningMessage,
          sendToWhatsApp: false, // Ya se envió con sendWhatsAppMessage
          isRelevant: true // Marcar como relevante para que se guarde en el historial
        });
      }
      
      // Prepare order data
      const orderData: ProcessedOrderData = {
        orderItems: preprocessedContent.orderItems,
        orderType: preprocessedContent.orderType,
        scheduledAt: preprocessedContent.scheduledAt,
      };
      
      // Use the new PreOrderWorkflowService
      const workflowResult = await PreOrderWorkflowService.createAndNotify({
        orderData,
        customerId: context.customer!.id,
        whatsappNumber: context.message.from,
      });
      
      // Store the action token in context for potential tracking
      context.set('lastPreOrderToken', workflowResult.actionToken);
      
      // Mark that interactive response was already sent by the workflow
      context.set('interactiveResponseSent', true);
    } catch (error: any) {
      logger.error('Error creating preorder:', error);
      
      // Para errores conocidos de negocio, usar el mensaje directo
      if (error instanceof BusinessLogicError || error instanceof ValidationError) {
        context.addResponse({
          text: error.message,
          isRelevant: true,
          sendToWhatsApp: true
        });
        return;
      }
      
      // Para otros errores, usar mensaje genérico
      const genericMessage = error instanceof TechnicalError 
        ? 'Lo siento, hubo un problema técnico. Por favor intenta de nuevo más tarde.'
        : 'Lo siento, hubo un error al procesar tu pedido. Por favor intenta de nuevo.';
      
      context.addResponse({
        text: genericMessage,
        isRelevant: true,
        sendToWhatsApp: true
      });
    }
  }
  
  private async processGeminiResponse(response: any, context?: MessageContext): Promise<any[]> {
    logger.debug('=== processGeminiResponse DEBUG ===');
    logger.debug('Response type:', typeof response);
    logger.debug('Response keys:', response ? Object.keys(response) : 'null');
    logger.debug('Has candidates:', !!response?.candidates);
    logger.debug('Candidates length:', response?.candidates?.length || 0);
    
    if (response?.candidates?.[0]) {
      const candidate = response.candidates[0];
      logger.debug('First candidate:', {
        hasContent: !!candidate.content,
        hasParts: !!candidate.content?.parts,
        partsLength: candidate.content?.parts?.length || 0
      });
      
      // Intentar mostrar el contenido de las partes
      if (candidate.content?.parts) {
        candidate.content.parts.forEach((part: any, index: number) => {
          logger.debug(`Part ${index}:`, {
            hasText: !!part.text,
            hasFunctionCall: !!part.functionCall,
            functionName: part.functionCall?.name,
            textPreview: part.text ? part.text.substring(0, 100) + '...' : null
          });
          
          // Si hay function call, mostrar los argumentos
          if (part.functionCall) {
            logger.debug(`Function call args:`, JSON.stringify(part.functionCall.args));
          }
        });
      }
    }
    
    const responses: any[] = [];
    
    // Verificar estructura de respuesta válida
    if (!response?.candidates?.[0]?.content?.parts) {
      logger.error('Estructura de respuesta inválida de Gemini API');
      logger.error('Response structure:', {
        hasResponse: !!response,
        hasCandidates: !!response?.candidates,
        candidatesLength: response?.candidates?.length,
        firstCandidate: response?.candidates?.[0],
        hasContent: !!response?.candidates?.[0]?.content,
        hasParts: !!response?.candidates?.[0]?.content?.parts
      });
      
      // Intentar usar mensaje de error más específico
      const errorMessage = response?.error?.message || 
                          response?.candidates?.[0]?.finishReason || 
                          "Lo siento, hubo un problema al procesar tu solicitud. Por favor intenta de nuevo.";
      
      return [{
        text: errorMessage,
        isRelevant: true
      }];
    }
    
    const parts = response.candidates[0].content.parts;
    
    // Procesar cada parte de la respuesta
    for (const part of parts) {
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
          part.functionCall.args,
          context
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
    
    logger.debug(`Total responses processed: ${responses.length}`);
    logger.debug('=== End processGeminiResponse DEBUG ===');
    
    return responses;
  }
  
  private async handleFunctionCall(name: string, args: any, context?: MessageContext): Promise<any | null> {
    logger.debug('=== handleFunctionCall DEBUG ===');
    logger.debug(`Function name: ${name}`);
    
    let result: any = null;
    
    switch (name) {
      case "map_order_items":
        // Transform AI order items to consistent format
        const processedItems = (args.orderItems || []).map((item: AIOrderItem) => 
          transformAIOrderItem(item)
        );
        
        result = {
          preprocessedContent: {
            orderItems: processedItems,
            orderType: args.orderType || 'DELIVERY', // Use the orderType from the order agent
            warnings: args.warnings ? [args.warnings] : [],
            scheduledAt: args.scheduledAt || null
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
            const parts = MessageSplitter.splitMenu(menuText, maxLength);
            logger.debug(`Menú dividido en ${parts.length} partes`);
            // Retornar múltiples respuestas
            result = parts.map((part, index) => ({
              text: part,
              isRelevant: false, // No guardar el menú completo en historial relevante
              sendToWhatsApp: true,
              // Para el último mensaje, agregar marcador de historial
              ...(index === parts.length - 1 && { 
                historyMarker: "MENÚ ENVIADO" 
              })
            }));
          } else {
            result = {
              text: menuText,
              isRelevant: false, // No guardar el menú completo en historial relevante
              sendToWhatsApp: true,
              historyMarker: "MENÚ ENVIADO" // Marcador para el historial
            };
          }
        } catch (error) {
          logger.error('Error obteniendo menú:', error);
          result = {
            text: '😔 Lo siento, no pude obtener el menú en este momento. Por favor, intenta de nuevo en unos momentos.',
            isRelevant: true
          };
        }
        break;
        
      case "get_business_hours":
        // Obtener información del restaurante y horarios
        try {
          const { RESTAURANT_INFO_MESSAGE } = await import('../../../common/config/predefinedMessages');
          const { ConfigService } = await import('../../../services/config/ConfigService');
          const { getFormattedBusinessHours } = await import('../../../common/utils/timeUtils');
          
          const config = ConfigService.getConfig();
          const formattedHours = await getFormattedBusinessHours();
          const infoMessage = RESTAURANT_INFO_MESSAGE(config, formattedHours);
          
          result = {
            text: infoMessage,
            isRelevant: true
          };
        } catch (error) {
          logger.error('Error obteniendo información del restaurante:', error);
          result = {
            text: '😔 Lo siento, no pude obtener la información del restaurante. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      case "prepare_order_context":
        // Preparar contexto para el agente de órdenes
        try {
          // Obtener menú relevante basado en los items mencionados
          const { MenuSearchService } = await import('../../ai/MenuSearchService');
          const relevantMenu = await MenuSearchService.getRelevantMenu(args.itemsSummary);
          
          // Si no se encontraron productos relevantes
          if (relevantMenu === "[]" || JSON.parse(relevantMenu).length === 0) {
            logger.warn('No relevant products found for order context');
            
            result = {
              text: `😔 No pude encontrar productos que coincidan con "${args.itemsSummary}". Por favor, intenta con otro nombre o revisa nuestro menú.`,
              isRelevant: true
            };
            break;
          }
          
          // Crear contexto para el agente de órdenes
          const orderContext = {
            itemsSummary: args.itemsSummary,
            relevantMenu: relevantMenu,
            orderType: args.orderType // Pass the order type from general agent
          };
          
          // Procesar con el agente de órdenes
          logger.debug('Calling processOrderMapping with context:', orderContext);
          const orderResponse = await AgentService.processOrderMapping(orderContext);
          logger.debug('Order agent response:', JSON.stringify(orderResponse, null, 2));
          
          // Procesar la respuesta del agente de órdenes
          const orderResults = await this.processGeminiResponse(orderResponse, context);
          logger.debug('Processed order results:', orderResults);
          
          // El agente de órdenes siempre debe ejecutar map_order_items
          // Así que devolvemos todos los resultados
          result = orderResults;
          
        } catch (error) {
          logger.error('Error preparando contexto de orden:', error);
          result = {
            text: '😔 Hubo un problema al procesar tu orden. Por favor, intenta nuevamente.',
            isRelevant: true
          };
        }
        break;
        
      case "generate_address_update_link":
        // Generar enlace para actualizar dirección
        try {
          logger.debug('Generando enlace de actualización de dirección:', args);
          
          // Importar servicios necesarios
          const { OTPService } = await import('../../security/OTPService');
          const { env } = await import('../../../common/config/envValidator');
          
          // Obtener el customerId del contexto
          const customerId = context?.message?.from;
          if (!customerId) {
            throw new Error('No se pudo obtener el ID del cliente');
          }
          
          // Generar OTP
          const otp = OTPService.generateOTP();
          await OTPService.storeOTP(customerId, otp, true); // true = address registration
          
          // Crear enlace de registro
          const registrationLink = `${env.FRONTEND_BASE_URL}/address-registration/${customerId}?otp=${otp}`;
          
          // Retornar configuración del mensaje con URL button para que se envíe y guarde
          result = {
            urlButton: {
              title: "📍 Actualizar Dirección",
              body: "Te he generado un enlace seguro para que puedas actualizar o agregar una nueva dirección de entrega.\n\n" +
                    "Este enlace es temporal y expirará en 10 minutos por seguridad.",
              buttonText: "Actualizar Dirección",
              url: registrationLink
            },
            isRelevant: true
          };
          
        } catch (error) {
          logger.error('Error generando enlace de dirección:', error);
          result = {
            text: '😔 No pude generar el enlace de actualización. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      case "send_bot_instructions":
        // Enviar instrucciones de cómo usar el bot
        try {
          logger.debug('Enviando instrucciones del bot');
          
          // Importar la función de instrucciones del bot
          const { CHATBOT_HELP_MESSAGE } = await import('../../../common/config/predefinedMessages');
          const { ConfigService } = await import('../../../services/config/ConfigService');
          
          // Obtener las instrucciones
          const config = ConfigService.getConfig();
          const instructions = CHATBOT_HELP_MESSAGE(config);
          
          result = {
            text: instructions,
            isRelevant: true
          };
          
        } catch (error) {
          logger.error('Error enviando instrucciones del bot:', error);
          result = {
            text: '😔 No pude obtener las instrucciones en este momento. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      case "get_wait_times":
        // Obtener tiempos de espera
        try {
          logger.debug('Obteniendo tiempos de espera');
          
          // Importar servicios necesarios
          const { WAIT_TIMES_MESSAGE } = await import('../../../common/config/predefinedMessages');
          const { RestaurantService } = await import('../../../services/restaurant/RestaurantService');
          
          // Obtener configuración del restaurante
          const config = await RestaurantService.getConfig();
          
          // Obtener los tiempos de espera
          const waitTimesMessage = WAIT_TIMES_MESSAGE(
            config.estimatedPickupTime,
            config.estimatedDeliveryTime
          );
          
          result = {
            text: waitTimesMessage,
            isRelevant: true
          };
          
        } catch (error) {
          logger.error('Error obteniendo tiempos de espera:', error);
          result = {
            text: '😔 No pude obtener los tiempos de espera. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      case "reset_conversation":
        // Reiniciar conversación
        try {
          logger.debug('Reiniciando conversación');
          
          // Importar servicios necesarios
          const { prisma } = await import('../../../server');
          const { CONVERSATION_RESET_MESSAGE } = await import('../../../common/config/predefinedMessages');
          
          // Obtener el customerId del contexto
          const customerId = context?.customer?.id;
          if (!customerId) {
            throw new Error('No se pudo obtener el ID del cliente');
          }
          
          // Reiniciar historial de chat relevante y completo INMEDIATAMENTE
          await prisma.customer.update({
            where: { id: customerId },
            data: { 
              relevantChatHistory: JSON.stringify([]),
              fullChatHistory: JSON.stringify([]),
              lastInteraction: new Date()
            }
          });
          
          // Import and mark for sync
          const { SyncMetadataService } = await import('../../../services/sync/SyncMetadataService');
          await SyncMetadataService.markForSync('Customer', customerId, 'REMOTE');
          
          // Limpiar el historial del contexto actual COMPLETAMENTE
          context?.set('relevantChatHistory', []);
          context?.set('fullChatHistory', []);
          
          // Marcar para que este intercambio completo NO se guarde
          context?.set('skipHistoryUpdate', true);
          
          // Marcar que se está reseteando la conversación para evitar mensaje de bienvenida
          context?.set('isResettingConversation', true);
          
          result = {
            text: CONVERSATION_RESET_MESSAGE,
            isRelevant: false
          };
          
        } catch (error) {
          logger.error('Error reiniciando conversación:', error);
          result = {
            text: '😔 Hubo un problema al reiniciar la conversación. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      default:
        logger.warn(`Function call no reconocido: ${name}`);
    }
    
    logger.debug('=== End handleFunctionCall DEBUG ===');
    return result;
  }
  
}