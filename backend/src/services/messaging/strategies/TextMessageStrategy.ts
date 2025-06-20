import { MessageStrategy } from './MessageStrategy';
import { MessageContext } from '../MessageContext';
import { AgentService } from '../../ai';
import { PreOrderService } from '../../../services/orders/PreOrderService';
import { sendWhatsAppMessage } from '../../whatsapp';
import logger from '../../../common/utils/logger';
import { MessageSplitter } from '../../../common/utils/messageSplitter';

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
      logger.debug('=== TextMessageStrategy.execute DEBUG ===');
      logger.debug('User message:', text);
      logger.debug('Customer:', context.customer ? `ID: ${context.customer.id}, Phone: ${context.customer.whatsappPhoneNumber}` : 'No customer');
      logger.debug('Chat history length:', relevantChatHistory.length);
      
      // Procesar con AI - usar workingHistory que incluye el mensaje actual
      const messages: Content[] = workingHistory.map(
        ({ role, content }: any) => ({
          role: role === "assistant" ? "model" : role,
          parts: [{ text: content }]
        })
      );
      
      (logger as any).json('Messages to send to AI:', messages);
      
      const response = await AgentService.processMessage(messages);
      
      // Convertir respuesta al formato esperado
      const aiResponses = await this.processGeminiResponse(response, context);
      
      (logger as any).json('Processed AI responses:', aiResponses);
      logger.debug('=== End TextMessageStrategy.execute DEBUG ===');
      
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
    // Handle warnings
    if (preprocessedContent.warnings && preprocessedContent.warnings.length > 0) {
      const warningMessage = "📝 Observaciones:\n" + preprocessedContent.warnings.join("\n");
      await sendWhatsAppMessage(context.message.from, warningMessage);
    }
    
    // Create pre-order
    const preOrderService = new PreOrderService();
    const preOrderResult = await preOrderService.createPreOrder({
      orderItems: preprocessedContent.orderItems,
      whatsappPhoneNumber: context.message.from,
      orderType: preprocessedContent.orderType,
      scheduledAt: preprocessedContent.scheduledAt,
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
  
  private async processGeminiResponse(response: any, context?: MessageContext): Promise<any[]> {
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
        (logger as any).json('Function call:', functionInfo);
        
        const functionResponse = await this.handleFunctionCall(
          part.functionCall.name,
          part.functionCall.args,
          context
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
  
  private async handleFunctionCall(name: string, args: any, context?: MessageContext): Promise<any | null> {
    logger.debug('=== handleFunctionCall DEBUG ===');
    logger.debug(`Function name: ${name}`);
    (logger as any).json('Function args:', args);
    
    let result: any = null;
    
    switch (name) {
      case "map_order_items":
        // Procesar mapeo de items del pedido
        // Asegurar que cada item tenga el formato correcto
        const processedItems = (args.orderItems || []).map((item: any) => ({
          productId: item.productId,
          productVariantId: item.variantId || null, // Map variantId to productVariantId
          quantity: item.quantity || 1,
          selectedModifiers: item.modifiers || [], // Map modifiers to selectedModifiers
          selectedPizzaIngredients: item.pizzaIngredients || [] // Map pizzaIngredients to selectedPizzaIngredients
        }));
        
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
            text: "Lo siento, no pude obtener el menú en este momento.",
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
            text: "Lo siento, no pude obtener la información del restaurante en este momento.",
            isRelevant: true
          };
        }
        break;
        
      case "prepare_order_context":
        // Preparar contexto para el agente de órdenes
        try {
          logger.debug('Preparando contexto de orden:', args);
          
          // Obtener menú relevante basado en los items mencionados
          const { MenuSearchService } = await import('../../ai/MenuSearchService');
          const relevantMenu = await MenuSearchService.getRelevantMenu(args.itemsSummary);
          
          // Crear contexto para el agente de órdenes
          const orderContext = {
            itemsSummary: args.itemsSummary,
            relevantMenu: relevantMenu,
            orderType: args.orderType // Pass the order type from general agent
          };
          
          // Procesar con el agente de órdenes
          const orderResponse = await AgentService.processOrderMapping(orderContext);
          
          // Procesar la respuesta del agente de órdenes
          const orderResults = await this.processGeminiResponse(orderResponse, context);
          
          // El agente de órdenes siempre debe ejecutar map_order_items
          // Así que devolvemos todos los resultados
          result = orderResults;
          
        } catch (error) {
          logger.error('Error preparando contexto de orden:', error);
          result = {
            text: "Lo siento, hubo un error al procesar tu pedido. Por favor intenta de nuevo.",
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
            text: "Lo siento, hubo un error al generar el enlace. Por favor intenta de nuevo.",
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
            text: "Lo siento, hubo un error al obtener las instrucciones. Por favor intenta de nuevo.",
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
            text: "Lo siento, no pude obtener los tiempos de espera en este momento.",
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
          
          // Limpiar el historial del contexto actual COMPLETAMENTE
          context?.set('relevantChatHistory', []);
          context?.set('fullChatHistory', []);
          
          // Marcar para que este intercambio completo NO se guarde
          context?.set('skipHistoryUpdate', true);
          
          result = {
            text: CONVERSATION_RESET_MESSAGE,
            isRelevant: false
          };
          
        } catch (error) {
          logger.error('Error reiniciando conversación:', error);
          result = {
            text: "Lo siento, hubo un error al reiniciar la conversación. Por favor intenta de nuevo.",
            isRelevant: true
          };
        }
        break;
        
      default:
        logger.warn(`Function call no reconocido: ${name}`);
    }
    
    if (result) {
      (logger as any).json('Function call result:', result);
    }
    logger.debug('=== End handleFunctionCall DEBUG ===');
    return result;
  }
  
}