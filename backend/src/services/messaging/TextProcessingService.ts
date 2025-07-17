import { MessageContext } from './MessageContext';
import { AgentService } from '../ai';
import { PreOrderWorkflowService } from '../orders/PreOrderWorkflowService';
import { sendWhatsAppMessage } from '../whatsapp';
import logger from '../../common/utils/logger';
import { MessageSplitter } from '../../common/utils/messageSplitter';
import { ProcessedOrderData } from '../../common/types/preorder.types';
import { AIOrderItem, transformAIOrderItem } from '../../common/types';
import { ValidationError, BusinessLogicError, TechnicalError, ErrorCode } from '../../common/services/errors';

// Type definition for content
interface Content {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export class TextProcessingService {
  /**
   * Process text input through the AI agent system
   * This can be called by any strategy that needs to process text
   */
  static async processTextMessage(
    text: string,
    context: MessageContext
  ): Promise<void> {
    if (!context.customer) {
      throw new BusinessLogicError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found in context'
      );
    }

    let relevantChatHistory = context.get('relevantChatHistory') || [];
    
    // Create a working copy that includes the current message
    const workingHistory = [...relevantChatHistory];
    workingHistory.push({ role: "user", content: text });
    
    try {
      // Process with AI - use workingHistory that includes the current message
      const messages: Content[] = workingHistory.map(
        ({ role, content }: any) => ({
          role: role === "assistant" ? "model" : role,
          parts: [{ text: content }]
        })
      );
      
      logger.debug('Calling AgentService.processMessage with messages:', messages);
      const response = await AgentService.processMessage(messages);
      logger.debug('AgentService response:', JSON.stringify(response, null, 2));
      
      // Convert response to expected format
      const aiResponses = await this.processGeminiResponse(response, context);
      
      // Process AI responses
      for (const response of aiResponses) {
        if (response.text) {
          context.addResponse({
            text: response.text,
            sendToWhatsApp: response.sendToWhatsApp !== false,
            isRelevant: response.isRelevant !== false,
            historyMarker: response.historyMarker
          });
        }
        
        if (response.urlButton) {
          // Handle URL button message
          const { sendMessageWithUrlButton } = await import('../whatsapp');
          await sendMessageWithUrlButton(
            context.message.from,
            response.urlButton.title,
            response.urlButton.body,
            response.urlButton.buttonText,
            response.urlButton.url
          );
          
          // Add to context so it's saved in history
          context.addResponse({
            text: `${response.urlButton.title}\n\n${response.urlButton.body}`,
            sendToWhatsApp: false, // Already sent with sendMessageWithUrlButton
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

  private static async handlePreprocessedContent(context: MessageContext, preprocessedContent: any): Promise<void> {
    try {
      // Handle warnings
      if (preprocessedContent.warnings && preprocessedContent.warnings.length > 0) {
        const warningMessage = "📝 Observaciones:\n" + preprocessedContent.warnings.join("\n");
        await sendWhatsAppMessage(context.message.from, warningMessage);
        
        // Add observations to context so they're saved in relevant history
        context.addResponse({
          text: warningMessage,
          sendToWhatsApp: false, // Already sent with sendWhatsAppMessage
          isRelevant: true
        });
      }
      
      // Prepare order data
      const orderData: ProcessedOrderData = {
        orderItems: preprocessedContent.orderItems,
        orderType: preprocessedContent.orderType,
        scheduledAt: preprocessedContent.scheduledAt,
      };
      
      // Use the PreOrderWorkflowService
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
      
      // For known business errors, use the direct message
      if (error instanceof BusinessLogicError || error instanceof ValidationError) {
        context.addResponse({
          text: error.message,
          isRelevant: true,
          sendToWhatsApp: true
        });
        return;
      }
      
      // For other errors, use generic message
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

  private static async processGeminiResponse(response: any, context?: MessageContext): Promise<any[]> {
    logger.debug('=== processGeminiResponse DEBUG ===');
    logger.debug('Response type:', typeof response);
    logger.debug('Response keys:', response ? Object.keys(response) : 'null');
    
    const responses: any[] = [];
    
    // Verify valid response structure
    if (!response?.candidates?.[0]?.content?.parts) {
      logger.error('Invalid response structure from Gemini API');
      
      const errorMessage = response?.error?.message || 
                          response?.candidates?.[0]?.finishReason || 
                          "Lo siento, hubo un problema al procesar tu solicitud. Por favor intenta de nuevo.";
      
      return [{
        text: errorMessage,
        isRelevant: true
      }];
    }
    
    const parts = response.candidates[0].content.parts;
    
    // Process each part of the response
    for (const part of parts) {
      if (part.text) {
        // Simple text response
        responses.push({
          text: part.text,
          isRelevant: true,
        });
      } else if (part.functionCall) {
        // Process function calls
        const functionResponse = await this.handleFunctionCall(
          part.functionCall.name,
          part.functionCall.args,
          context
        );
        if (functionResponse) {
          // If function returns an array (multiple messages), add all
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

  private static async handleFunctionCall(name: string, args: any, context?: MessageContext): Promise<any | null> {
    logger.debug(`=== handleFunctionCall: ${name} ===`);
    
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
            orderType: args.orderType || 'DELIVERY',
            warnings: args.warnings ? [args.warnings] : [],
            scheduledAt: args.scheduledAt || null
          }
        };
        break;
        
      case "send_menu":
        // Send menu
        try {
          const { ProductService } = await import('../products/ProductService');
          const menu = await ProductService.getActiveProducts({ formatForAI: true });
          const menuText = String(menu);
          
          // If menu is too long, split it
          const maxLength = 4000;
          if (menuText.length > maxLength) {
            const parts = MessageSplitter.splitMenu(menuText, maxLength);
            logger.debug(`Menu split into ${parts.length} parts`);
            result = parts.map((part, index) => ({
              text: part,
              isRelevant: false,
              sendToWhatsApp: true,
              ...(index === parts.length - 1 && { 
                historyMarker: "MENÚ ENVIADO" 
              })
            }));
          } else {
            result = {
              text: menuText,
              isRelevant: false,
              sendToWhatsApp: true,
              historyMarker: "MENÚ ENVIADO"
            };
          }
        } catch (error) {
          logger.error('Error getting menu:', error);
          result = {
            text: '😔 Lo siento, no pude obtener el menú en este momento. Por favor, intenta de nuevo en unos momentos.',
            isRelevant: true
          };
        }
        break;
        
      case "get_business_hours":
        // Get restaurant info and hours
        try {
          const { RESTAURANT_INFO_MESSAGE } = await import('../../common/config/predefinedMessages');
          const { ConfigService } = await import('../config/ConfigService');
          const { getFormattedBusinessHours } = await import('../../common/utils/timeUtils');
          
          const config = ConfigService.getConfig();
          const formattedHours = await getFormattedBusinessHours();
          const infoMessage = RESTAURANT_INFO_MESSAGE(config, formattedHours);
          
          result = {
            text: infoMessage,
            isRelevant: true
          };
        } catch (error) {
          logger.error('Error getting restaurant info:', error);
          result = {
            text: '😔 Lo siento, no pude obtener la información del restaurante. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      case "prepare_order_context":
        // Prepare context for order agent
        try {
          const { MenuSearchService } = await import('../ai/MenuSearchService');
          const relevantMenu = await MenuSearchService.getRelevantMenu(args.itemsSummary);
          
          if (relevantMenu === "[]" || JSON.parse(relevantMenu).length === 0) {
            logger.warn('No relevant products found for order context');
            
            result = {
              text: `😔 No pude encontrar productos que coincidan con "${args.itemsSummary}". Por favor, intenta con otro nombre o revisa nuestro menú.`,
              isRelevant: true
            };
            break;
          }
          
          const orderContext = {
            itemsSummary: args.itemsSummary,
            relevantMenu: relevantMenu,
            orderType: args.orderType
          };
          
          logger.debug('Calling processOrderMapping with context:', orderContext);
          const orderResponse = await AgentService.processOrderMapping(orderContext);
          logger.debug('Order agent response:', JSON.stringify(orderResponse, null, 2));
          
          const orderResults = await this.processGeminiResponse(orderResponse, context);
          logger.debug('Processed order results:', orderResults);
          
          result = orderResults;
          
        } catch (error) {
          logger.error('Error preparing order context:', error);
          result = {
            text: '😔 Hubo un problema al procesar tu orden. Por favor, intenta nuevamente.',
            isRelevant: true
          };
        }
        break;
        
      case "generate_address_update_link":
        // Generate address update link
        try {
          logger.debug('Generating address update link:', args);
          
          const { OTPService } = await import('../security/OTPService');
          const { env } = await import('../../common/config/envValidator');
          
          const customerId = context?.message?.from;
          if (!customerId) {
            throw new TechnicalError(
              ErrorCode.CUSTOMER_NOT_FOUND,
              'Could not get customer ID from message context'
            );
          }
          
          const otp = OTPService.generateOTP();
          await OTPService.storeOTP(customerId, otp, true);
          
          const registrationLink = `${env.FRONTEND_BASE_URL}/address-registration/${customerId}?otp=${otp}`;
          
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
          logger.error('Error generating address link:', error);
          result = {
            text: '😔 No pude generar el enlace de actualización. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      case "send_bot_instructions":
        // Send bot instructions
        try {
          logger.debug('Sending bot instructions');
          
          const { CHATBOT_HELP_MESSAGE } = await import('../../common/config/predefinedMessages');
          const { ConfigService } = await import('../config/ConfigService');
          
          const config = ConfigService.getConfig();
          const instructions = CHATBOT_HELP_MESSAGE(config);
          
          result = {
            text: instructions,
            isRelevant: true
          };
          
        } catch (error) {
          logger.error('Error sending bot instructions:', error);
          result = {
            text: '😔 No pude obtener las instrucciones en este momento. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      case "get_wait_times":
        // Get wait times
        try {
          logger.debug('Getting wait times');
          
          const { WAIT_TIMES_MESSAGE } = await import('../../common/config/predefinedMessages');
          const { RestaurantService } = await import('../restaurant/RestaurantService');
          
          const config = await RestaurantService.getConfig();
          
          const waitTimesMessage = WAIT_TIMES_MESSAGE(
            config.estimatedPickupTime,
            config.estimatedDeliveryTime
          );
          
          result = {
            text: waitTimesMessage,
            isRelevant: true
          };
          
        } catch (error) {
          logger.error('Error getting wait times:', error);
          result = {
            text: '😔 No pude obtener los tiempos de espera. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      case "reset_conversation":
        // Reset conversation
        try {
          logger.debug('Resetting conversation');
          
          const { prisma } = await import('../../server');
          const { CONVERSATION_RESET_MESSAGE } = await import('../../common/config/predefinedMessages');
          
          const customerId = context?.customer?.id;
          if (!customerId) {
            throw new TechnicalError(
              ErrorCode.CUSTOMER_NOT_FOUND,
              'Could not get customer ID from context'
            );
          }
          
          await prisma.customer.update({
            where: { id: customerId },
            data: { 
              relevantChatHistory: JSON.stringify([]),
              fullChatHistory: JSON.stringify([]),
              lastInteraction: new Date()
            }
          });
          
          const { SyncMetadataService } = await import('../sync/SyncMetadataService');
          await SyncMetadataService.markForSync('Customer', customerId, 'REMOTE');
          
          context?.set('relevantChatHistory', []);
          context?.set('fullChatHistory', []);
          context?.set('skipHistoryUpdate', true);
          context?.set('isResettingConversation', true);
          
          result = {
            text: CONVERSATION_RESET_MESSAGE,
            isRelevant: false
          };
          
        } catch (error) {
          logger.error('Error resetting conversation:', error);
          result = {
            text: '😔 Hubo un problema al reiniciar la conversación. Por favor, intenta más tarde.',
            isRelevant: true
          };
        }
        break;
        
      default:
        logger.warn(`Unrecognized function call: ${name}`);
    }
    
    logger.debug('=== End handleFunctionCall ===');
    return result;
  }
}